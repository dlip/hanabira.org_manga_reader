from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import requests
import os
from typing import Dict, List, Optional
import logging
from config import Config
from db import init_db, insert_flashcard, get_flashcards, get_flashcard, delete_flashcard
import base64
import re
from uuid import uuid4
import json
from functools import wraps
import time
from datetime import datetime
from dataclasses import dataclass

# ===== Shared Library Root (chapters HTML/assets) =====
# Existing chapter deletion logic assumes a docker-mounted path at backend/shared/library
SHARED_LIBRARY_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), 'shared', 'library'))
os.makedirs(SHARED_LIBRARY_ROOT, exist_ok=True)

@dataclass
class OrphanChapterDir:
    series_id: str
    chapter_folder: str  # may be '' for an entire unused series directory
    abs_path: str
    rel_path: str
    size_bytes: int
    file_count: int
    kind: str  # 'chapter' or 'series'

def _gather_existing_chapter_dir_pairs() -> set[tuple[str, str]]:
    """Return set of (series_id, chapter_folder) pairs referenced by chapters.file_path rows.
    We parse stored file_path values of form /library/<series>/<chapterFolder>/<file>.html
    """
    from db import get_chapters
    pairs: set[tuple[str, str]] = set()
    for ch in get_chapters():
        fp = ch.get('file_path') or ''
        fp_clean = fp.split('?')[0].split('#')[0]
        if fp_clean.startswith('/library/'):
            parts = fp_clean.strip('/').split('/')
            if len(parts) >= 4:  # library, series, chapterFolder, file
                pairs.add((parts[1], parts[2]))
    return pairs

def _compute_dir_stats(path: str) -> tuple[int, int]:
    size = 0
    count = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            count += 1
            try:
                size += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return size, count

def _find_orphan_chapter_dirs() -> list[OrphanChapterDir]:
    """Find orphan chapter directories and entirely orphan series directories.
    A series directory is orphan ONLY if the series does not exist in the database.
    Individual chapter directories are orphan if not referenced in any chapter.file_path.
    
    FIXED: Now checks series existence in DB to avoid marking active series as orphans.
    FIXED: Only adds series-level orphan when series truly doesn't exist in DB.
    
    VALIDATION: Warns about non-UUID directory names (should always be UUIDs).
    """
    import re
    from db import get_series_by_id
    
    # UUID pattern validation (8-4-4-4-12 hex format)
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    
    existing_pairs = _gather_existing_chapter_dir_pairs()
    orphans: list[OrphanChapterDir] = []
    
    if not os.path.isdir(SHARED_LIBRARY_ROOT):
        return orphans
    
    for series_id in os.listdir(SHARED_LIBRARY_ROOT):
        series_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
        if not os.path.isdir(series_dir):
            continue
        
        # Validate series directory name is UUID format
        if not UUID_PATTERN.match(series_id):
            logger.warning(f"⚠️ Non-UUID series directory detected: {series_id} - This should not exist! Expected UUID format.")
            # Still process it as potential orphan for cleanup
        
        try:
            child_dirs: list[str] = []
            orphaned_chapters: list[str] = []
            
            # Check all chapter directories
            for chapter_folder in os.listdir(series_dir):
                chapter_dir = os.path.join(series_dir, chapter_folder)
                if not os.path.isdir(chapter_dir):
                    continue
                
                child_dirs.append(chapter_folder)
                pair = (series_id, chapter_folder)
                
                # Mark as orphan chapter if not in DB
                if pair not in existing_pairs:
                    orphaned_chapters.append(chapter_folder)
                    size, count = _compute_dir_stats(chapter_dir)
                    rel_path = f"/library/{series_id}/{chapter_folder}"
                    orphans.append(OrphanChapterDir(
                        series_id, chapter_folder, chapter_dir, 
                        rel_path, size, count, 'chapter'
                    ))
            
            # Series-level orphan detection: ONLY add if series doesn't exist in DB
            # This prevents marking active series as orphans even if some chapters are orphaned
            series_in_db = get_series_by_id(series_id)
            
            if not series_in_db:
                # Series not in database - entire directory is orphaned
                # Include it whether it has children or is empty
                if child_dirs or not os.listdir(series_dir):
                    size, count = _compute_dir_stats(series_dir)
                    rel_path = f"/library/{series_id}"
                    orphans.append(OrphanChapterDir(
                        series_id, '', series_dir, 
                        rel_path, size, count, 'series'
                    ))
                    
        except Exception as e:
            logger.warning(f"Failed scanning series dir {series_dir}: {e}")
    
    return orphans

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def log_endpoint_access(f):
    """Decorator to log endpoint access with method, path, and payload."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Log endpoint hit
        endpoint = request.endpoint or f.__name__
        method = request.method
        path = request.path
        
        logger.info(f"🔄 ENDPOINT HIT: {method} {path} (function: {endpoint})")
        
        # Log query parameters
        if request.args:
            logger.info(f"📥 Query params: {dict(request.args)}")
        
        # Log URL parameters (path variables)
        if kwargs:
            logger.info(f"🔗 URL params: {kwargs}")
        
        # Log request payload for POST/PUT requests
        if method in ['POST', 'PUT', 'PATCH']:
            try:
                if request.is_json:
                    payload = request.get_json()
                    # Truncate large payloads for logging
                    if isinstance(payload, dict):
                        log_payload = {k: (v if len(str(v)) < 200 else f"{str(v)[:200]}...") 
                                     for k, v in payload.items()}
                    else:
                        log_payload = payload
                    logger.info(f"📦 Request payload: {json.dumps(log_payload, default=str, indent=2)}")
                elif request.form:
                    form_data = dict(request.form)
                    logger.info(f"📋 Form data: {form_data}")
                elif request.files:
                    files_info = {name: f"{file.filename} ({file.content_type})" 
                                for name, file in request.files.items()}
                    logger.info(f"📁 Files: {files_info}")
            except Exception as e:
                logger.warning(f"⚠️ Could not log payload: {e}")
        
        # Execute the endpoint function
        try:
            result = f(*args, **kwargs)
            logger.info(f"✅ ENDPOINT SUCCESS: {method} {path}")
            return result
        except Exception as e:
            logger.error(f"❌ ENDPOINT ERROR: {method} {path} - {str(e)}")
            raise
    
    return decorated_function

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Initialize OpenAI client (v1+)
# Prefer explicit client configuration over globals
client_kwargs = {}
if Config.OPENAI_API_KEY:
    client_kwargs["api_key"] = Config.OPENAI_API_KEY
if Config.OPENAI_ORG_ID:
    client_kwargs["organization"] = Config.OPENAI_ORG_ID
openai_client = OpenAI(**client_kwargs)

# Initialize database
init_db()

# Paths
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

def save_data_url_image(data_url: str) -> str:
    """Save a data URL image to disk and return the relative filename."""
    # Expected format: data:image/png;base64,XXXX
    match = re.match(r"^data:(image\/[^;]+);base64,(.*)$", data_url)
    if not match:
        raise ValueError("Invalid image data URL")
    mime, b64 = match.groups()
    ext = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
    }.get(mime, "png")

    binary = base64.b64decode(b64)
    name = f"fc_{uuid4().hex}.{ext}"
    path = os.path.join(IMAGES_DIR, name)
    with open(path, "wb") as f:
        f.write(binary)
    return name

class TranslationService:
    """Service class to handle different translation providers"""
    
    @staticmethod
    def translate_with_openai(text: str, source_lang: str = "Japanese", target_lang: str = "English", model_alias: str | None = None) -> Dict:
        """Translate text using OpenAI ChatGPT API"""
        try:
            # Resolve model alias to actual API name
            if model_alias is None:
                model_alias = Config.OPENAI_DEFAULT_MODEL
            model_info = Config.OPENAI_MODELS.get(model_alias)
            if not model_info:
                return {
                    "success": False,
                    "error": f"Unknown OpenAI model: {model_alias}",
                    "provider": "openai"
                }

            api_model = model_info.get("api_name", model_alias)
            endpoint = model_info.get("endpoint", "responses")
            max_param = model_info.get("max_param", "max_completion_tokens")

            system_prompt = (
                f"You are a professional translator specializing in {source_lang} to {target_lang} translation. "
                f"Provide accurate, natural translations. For Japanese text, also provide romanization (romaji) when helpful. "
                f"Format your response as: Translation: [translated text]"
            )
            user_prompt = f"Translate this {source_lang} text to {target_lang}: {text}"

            translation = None

            if endpoint == "responses":
                # Use Responses API (modern models like gpt-4.1, gpt-5, o-series)
                params: Dict = {
                    "model": api_model,
                    # SDK v1 supports raw text array for simple single-turn inputs
                    "input": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                }
                params[max_param] = 500  # e.g., max_output_tokens
                resp = openai_client.responses.create(**params)

                # Extract text robustly from Responses API
                content_text = getattr(resp, "output_text", None)
                if not content_text:
                    # Fallback: iterate structured output
                    try:
                        parts = []
                        output = getattr(resp, "output", None) or []
                        for item in output:
                            content_list = getattr(item, "content", None) or []
                            for seg in content_list:
                                seg_type = getattr(seg, "type", None)
                                txt = getattr(seg, "text", None) or getattr(seg, "output_text", None)
                                if txt and (seg_type in ("text", "output_text", None)):
                                    parts.append(txt)
                        content_text = "\n".join(parts).strip() if parts else None
                    except Exception:
                        content_text = None
                translation = (content_text or "").strip()

            else:
                # Fallback: Chat Completions for any remaining chat-compatible models
                resp = openai_client.chat.completions.create(
                    model=api_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=500,
                )
                translation = resp.choices[0].message.content.strip()
            
            # Clean up the response to extract just the translation
            if "Translation:" in translation:
                translation = translation.split("Translation:", 1)[1].strip()
            
            return {
                "success": True,
                "translation": translation,
                "provider": "openai",
                "source_text": text
            }
            
        except Exception as e:
            logger.error(f"OpenAI translation error: {str(e)}")
            return {
                "success": False,
                "error": f"OpenAI translation failed: {str(e)}",
                "provider": "openai"
            }
    
    @staticmethod
    def translate_with_deepl(text: str, source_lang: str = "JA", target_lang: str = "EN") -> Dict:
        """Translate text using DeepL API"""
        try:
            headers = {
                "Authorization": f"DeepL-Auth-Key {Config.DEEPL_API_KEY}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "text": text,
                "source_lang": source_lang,
                "target_lang": target_lang
            }
            
            response = requests.post(Config.DEEPL_API_URL, headers=headers, data=data)
            
            if response.status_code == 200:
                result = response.json()
                translations = result.get("translations", [])
                
                if translations:
                    translation = translations[0]["text"]
                    detected_source = translations[0].get("detected_source_language", source_lang)
                    
                    return {
                        "success": True,
                        "translation": translation,
                        "provider": "deepl",
                        "source_text": text,
                        "detected_language": detected_source
                    }
                else:
                    return {
                        "success": False,
                        "error": "No translations returned from DeepL",
                        "provider": "deepl"
                    }
            else:
                return {
                    "success": False,
                    "error": f"DeepL API error: {response.status_code} - {response.text}",
                    "provider": "deepl"
                }
                
        except Exception as e:
            logger.error(f"DeepL translation error: {str(e)}")
            return {
                "success": False,
                "error": f"DeepL translation failed: {str(e)}",
                "provider": "deepl"
            }

    @staticmethod
    def explain_grammar_with_openai(text: str, model_alias: str | None = None) -> Dict:
        """Generate grammar explanation for Japanese text using OpenAI ChatGPT API"""
        try:
            # Resolve model alias to actual API name
            if model_alias is None:
                model_alias = Config.OPENAI_DEFAULT_MODEL
            model_info = Config.OPENAI_MODELS.get(model_alias)
            if not model_info:
                return {
                    "success": False,
                    "error": f"Unknown OpenAI model: {model_alias}",
                    "provider": "openai"
                }

            api_model = model_info.get("api_name", model_alias)
            endpoint = model_info.get("endpoint", "responses")
            max_param = model_info.get("max_param", "max_completion_tokens")

            system_prompt = (
                "You are a Japanese language expert specializing in grammar explanations for manga text. "
                "The text you'll analyze comes from Japanese manga, so consider manga-specific language patterns, "
                "casual speech, dialogue conventions, and visual storytelling context. "
                "Analyze the provided Japanese text and explain its grammar structure in detail. "
                "Format your response in clean Markdown with the following structure:\n\n"
                "## Grammar Analysis\n"
                "### Sentence Structure\n"
                "[Explain the overall sentence structure]\n\n"
                "### Key Grammar Points\n"
                "- **[Grammar Point 1]**: [Explanation]\n"
                "- **[Grammar Point 2]**: [Explanation]\n\n"
                "### Vocabulary Breakdown\n"
                "- **[Word 1]** ([Reading]): [Meaning and grammatical role]\n"
                "- **[Word 2]** ([Reading]): [Meaning and grammatical role]\n\n"
                "### Learning Notes\n"
                "[Additional insights, nuances, or learning tips relevant to manga context]\n\n"
                "Focus on being educational and clear for Japanese learners reading manga."
            )
            user_prompt = f"Please provide a detailed grammar explanation for this Japanese text: {text}"

            explanation = None

            if endpoint == "responses":
                # Use Responses API (modern models like gpt-4.1, gpt-5, o-series)
                params: Dict = {
                    "model": api_model,
                    "input": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                }
                params[max_param] = 1000  # Longer response for detailed explanations
                resp = openai_client.responses.create(**params)

                # Extract text robustly from Responses API
                content_text = getattr(resp, "output_text", None)
                if not content_text:
                    try:
                        parts = []
                        output = getattr(resp, "output", None) or []
                        for item in output:
                            content_list = getattr(item, "content", None) or []
                            for seg in content_list:
                                seg_type = getattr(seg, "type", None)
                                txt = getattr(seg, "text", None) or getattr(seg, "output_text", None)
                                if txt and (seg_type in ("text", "output_text", None)):
                                    parts.append(txt)
                        content_text = "\n".join(parts).strip() if parts else None
                    except Exception:
                        content_text = None
                explanation = (content_text or "").strip()

            else:
                # Fallback: Chat Completions for chat-compatible models
                resp = openai_client.chat.completions.create(
                    model=api_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=1000,
                )
                explanation = resp.choices[0].message.content.strip()
            
            return {
                "success": True,
                "explanation": explanation,
                "provider": "openai",
                "source_text": text
            }
            
        except Exception as e:
            logger.error(f"OpenAI grammar explanation error: {str(e)}")
            return {
                "success": False,
                "error": f"OpenAI grammar explanation failed: {str(e)}",
                "provider": "openai"
            }

class FuriganaService:
    """Service class to handle furigana generation for Japanese text"""
    
    @staticmethod
    def generate_furigana(text: str) -> Dict:
        """Generate furigana for Japanese text using pykakasi"""
        try:
            import pykakasi
            
            # Initialize kakasi
            kks = pykakasi.kakasi()
            
            # Convert to furigana format
            result = kks.convert(text)
            
            furigana_pairs = []
            for item in result:
                orig = item.get('orig', '')
                hira = item.get('hira', '')
                
                # Only add furigana if it's different from original (i.e., contains kanji)
                if orig != hira and any('\u4e00' <= char <= '\u9faf' for char in orig):
                    furigana_pairs.append({
                        'kanji': orig,
                        'reading': hira
                    })
                else:
                    # For hiragana/katakana/punctuation, just add as text without furigana
                    furigana_pairs.append({
                        'text': orig
                    })
            
            return {
                "success": True,
                "furigana": furigana_pairs,
                "original_text": text
            }
            
        except ImportError:
            return {
                "success": False,
                "error": "pykakasi library not available"
            }
        except Exception as e:
            logger.error(f"Furigana generation error: {str(e)}")
            return {
                "success": False,
                "error": f"Furigana generation failed: {str(e)}"
            }

@app.route('/health')
@log_endpoint_access
def health():
    return jsonify({"status": "healthy", "timestamp": time.time()})

@app.route('/media/<path:filename>', methods=['GET'])
@log_endpoint_access
def media(filename: str):
    """Serve stored images."""
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/translate', methods=['POST'])
@log_endpoint_access
def translate():
    """Main translation endpoint that supports multiple providers"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({"error": "Empty text provided"}), 400

        provider = data.get('provider', 'openai')  # Default to OpenAI
        openai_model = data.get('openai_model')  # Optional model alias
        source_lang = data.get('source_lang')
        target_lang = data.get('target_lang')
        
        # Get translations from requested provider
        if provider.lower() == 'openai':
            source_lang = source_lang or "Japanese"
            target_lang = target_lang or "English"
            result = TranslationService.translate_with_openai(text, source_lang, target_lang, openai_model)
        elif provider.lower() == 'deepl':
            source_lang = source_lang or "JA"
            target_lang = target_lang or "EN"
            result = TranslationService.translate_with_deepl(text, source_lang, target_lang)
        else:
            return jsonify({"error": f"Unsupported provider: {provider}"}), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Translation endpoint error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/furigana', methods=['POST'])
@log_endpoint_access
def add_furigana():
    """Generate furigana for Japanese text"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({"error": "Empty text provided"}), 400
        
        result = FuriganaService.generate_furigana(text)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Furigana endpoint error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/grammar/explain', methods=['POST'])
@log_endpoint_access
def explain_grammar():
    """Generate grammar explanation for Japanese text using ChatGPT"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({"error": "Empty text provided"}), 400

        openai_model = data.get('openai_model')  # Optional model alias
        
        # Get grammar explanation from OpenAI
        result = TranslationService.explain_grammar_with_openai(text, openai_model)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Grammar explanation endpoint error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

def process_flashcard_furigana(card: Dict) -> Dict:
    """Process flashcard furigana data for response"""
    if card.get("furigana"):
        import json
        try:
            card["furigana"] = json.loads(card["furigana"])
        except Exception:
            # If parsing fails, remove the invalid furigana data
            card["furigana"] = None
    return card

# Flashcards persistence endpoints
@app.route('/flashcards', methods=['GET'])
@log_endpoint_access
def list_flashcards():
    try:
        cards = get_flashcards()
        # Augment with public image URL and process furigana
        for c in cards:
            if c.get("image_path"):
                c["image_url"] = f"/media/{c['image_path']}"
            process_flashcard_furigana(c)
        return jsonify({"success": True, "flashcards": cards})
    except Exception as e:
        logger.error(f"List flashcards error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/flashcards/<card_id>', methods=['GET'])
@log_endpoint_access
def fetch_flashcard(card_id: str):
    try:
        card = get_flashcard(card_id)
        if not card:
            return jsonify({"success": False, "error": "Not found"}), 404
        if card.get("image_path"):
            card["image_url"] = f"/media/{card['image_path']}"
        process_flashcard_furigana(card)
        return jsonify({"success": True, "flashcard": card})
    except Exception as e:
        logger.error(f"Get flashcard error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/flashcards/<card_id>', methods=['DELETE'])
@log_endpoint_access
def delete_flashcard_endpoint(card_id: str):
    try:
        from services import delete_flashcard as delete_flashcard_service
        ok = delete_flashcard_service(card_id)
        if not ok:
            return jsonify({"success": False, "error": "Not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Delete flashcard error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/flashcards', methods=['POST'])
@log_endpoint_access
def create_flashcard():
    """Create a flashcard. Accepts JSON with optional base64 image data URL under 'image'."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["id", "front", "back", "timestamp"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        image_path = None
        img_data_url = data.get("image")
        if isinstance(img_data_url, str) and img_data_url.startswith("data:image"):
            try:
                image_path = save_data_url_image(img_data_url)
            except Exception as ie:
                logger.warning(f"Failed to save image, proceeding without it: {ie}")

        # Handle furigana data
        furigana_data = data.get("furigana")
        furigana_json = None
        if furigana_data:
            import json
            try:
                furigana_json = json.dumps(furigana_data)
            except Exception as e:
                logger.warning(f"Failed to serialize furigana data: {e}")

        record = {
            "id": data["id"],
            "front": data.get("front", ""),
            "back": data.get("back", ""),
            "reading": data.get("reading"),
            "image_path": image_path,
            "notes": data.get("notes"),
            "grammar": data.get("grammar"),
            "tags": ",".join(data.get("tags", [])) if isinstance(data.get("tags"), list) else data.get("tags"),
            "difficulty": data.get("difficulty"),
            "timestamp": data.get("timestamp"),
            "furigana": furigana_json,
        }

        insert_flashcard(record)

        # Initialize SRS record so new cards are immediately eligible for review
        try:
            from services import SRSService
            SRSService.initialize_card(record["id"])
        except Exception as se:
            logger.warning(f"Failed to initialize SRS for new flashcard {record['id']}: {se}")

        resp = {"success": True, "id": record["id"]}
        if image_path:
            resp["image_url"] = f"/media/{image_path}"
        return jsonify(resp), 201
    except Exception as e:
        logger.error(f"Create flashcard error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/translate/compare', methods=['POST'])
def compare_translations():
    """Endpoint to get translations from both providers for comparison"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({"error": "Empty text provided"}), 400
        
        # Get translations from both providers
        # Use default model for compare endpoint
        openai_result = TranslationService.translate_with_openai(text, model_alias=Config.OPENAI_DEFAULT_MODEL)
        deepl_result = TranslationService.translate_with_deepl(text)
        
        return jsonify({
            "source_text": text,
            "translations": {
                "openai": openai_result,
                "deepl": deepl_result
            }
        })
        
    except Exception as e:
        logger.error(f"Compare translations error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available model choices configured on the backend"""
    try:
        models = []
        for alias, meta in Config.OPENAI_MODELS.items():
            models.append({
                "alias": alias,
                "label": meta.get("label", alias),
                "api_name": meta.get("api_name", alias),
                "family": meta.get("family"),
                "tier": meta.get("tier"),
                "pricing": meta.get("pricing"),
                "notes": meta.get("notes"),
            })
        return jsonify({
            "openai": models,
            "default_openai_model": Config.OPENAI_DEFAULT_MODEL
        })
    except Exception as e:
        logger.error(f"List models error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


# ===== SERIES ENDPOINTS =====
@app.route('/series', methods=['GET'])
@log_endpoint_access
def list_series():
    try:
        from db import get_series
        series = get_series()
        return jsonify({"success": True, "series": series})
    except Exception as e:
        logger.error(f"List series error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/series/<series_id>', methods=['GET'])
@log_endpoint_access
def fetch_series(series_id: str):
    try:
        from db import get_series_by_id
        series = get_series_by_id(series_id)
        if not series:
            return jsonify({"success": False, "error": "Series not found"}), 404
        return jsonify({"success": True, "series": series})
    except Exception as e:
        logger.error(f"Get series error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/series', methods=['POST'])
@log_endpoint_access
def create_series():
    try:
        from db import insert_series
        data = request.get_json() or {}
        # Normalize/augment incoming data from various frontend versions
        normalized = {}
        # ID: accept provided, else generate UUID; coerce numeric IDs to string
        incoming_id = data.get("id")
        if incoming_id is None or incoming_id == "" or str(incoming_id).lower() == "undefined":
            normalized["id"] = str(uuid4())
        else:
            normalized["id"] = str(incoming_id)
        # Title required
        title = data.get("title")
        if not title:
            return jsonify({"success": False, "error": "Missing field: title"}), 400
        normalized["title"] = title
        # Optional simple passthrough fields
        for k_src, k_dst in [
            ("author", "author"),
            ("description", "description"),
            ("cover_image", "cover_image"),
            ("genre", "genre"),
            ("total_chapters", "total_chapters"),
            ("last_read_date", "last_read_date")
        ]:
            if data.get(k_src) is not None:
                normalized[k_dst] = data.get(k_src)
        # Status: map frontend statuses to backend ones or default
        status = data.get("status") or data.get("reading_status")
        allowed_status = {"ongoing", "completed", "reading", "on-hold", "dropped"}
        if status and status not in allowed_status:
            # Fallback to ongoing if unexpected
            status = "ongoing"
        normalized["status"] = status or "ongoing"
        # added_date: accept int timestamp, ISO string, or generate now
        import time, datetime
        added_raw = data.get("added_date") or data.get("created_at")
        ts = None
        if isinstance(added_raw, (int, float)):
            ts = int(added_raw)
        elif isinstance(added_raw, str):
            # Try parse ISO
            try:
                ts = int(datetime.datetime.fromisoformat(added_raw.replace("Z","" )).timestamp())
            except Exception:
                # Try parse numeric string
                try:
                    ts = int(float(added_raw))
                except Exception:
                    ts = int(time.time())
        else:
            ts = int(time.time())
        normalized["added_date"] = ts
        # last_read_date normalization if ISO
        if "last_read_date" in normalized and isinstance(normalized["last_read_date"], str):
            try:
                normalized["last_read_date"] = int(datetime.datetime.fromisoformat(normalized["last_read_date"].replace("Z","" )).timestamp())
            except Exception:
                normalized["last_read_date"] = None
        insert_series(normalized)
        return jsonify({"success": True, "id": normalized["id"], "normalized": True}), 201
    except Exception as e:
        logger.error(f"Create series error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/series/<series_id>', methods=['PUT'])
@log_endpoint_access
def update_series_endpoint(series_id: str):
    try:
        from db import update_series
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        success = update_series(series_id, data)
        if not success:
            return jsonify({"success": False, "error": "Series not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Update series error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/series/<series_id>', methods=['DELETE'])
@log_endpoint_access
def remove_series(series_id: str):
    try:
        from db import delete_series
        success = delete_series(series_id)
        if not success:
            return jsonify({"success": False, "error": "Series not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Delete series error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== CHAPTER ENDPOINTS =====
@app.route('/chapters', methods=['GET'])
@log_endpoint_access
def list_chapters():
    try:
        from db import get_chapters
        series_id = request.args.get('series_id')
        chapters = get_chapters(series_id)
        return jsonify({"success": True, "chapters": chapters})
    except Exception as e:
        logger.error(f"List chapters error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/chapters/<chapter_id>', methods=['GET'])
@log_endpoint_access
def fetch_chapter(chapter_id: str):
    try:
        from db import get_chapter_by_id
        chapter = get_chapter_by_id(chapter_id)
        if not chapter:
            return jsonify({"success": False, "error": "Chapter not found"}), 404
        return jsonify({"success": True, "chapter": chapter})
    except Exception as e:
        logger.error(f"Get chapter error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/chapters', methods=['POST'])
@log_endpoint_access
def create_chapter():
    try:
        from db import insert_chapter
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["id", "series_id", "chapter_number", "file_path", "added_date"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        insert_chapter(data)
        return jsonify({"success": True, "id": data["id"]}), 201
    except Exception as e:
        logger.error(f"Create chapter error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/chapters/<chapter_id>', methods=['PUT'])
@log_endpoint_access
def update_chapter_endpoint(chapter_id: str):
    try:
        from db import update_chapter
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        success = update_chapter(chapter_id, data)
        if not success:
            return jsonify({"success": False, "error": "Chapter not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Update chapter error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/chapters/<chapter_id>', methods=['DELETE'])
@log_endpoint_access
def remove_chapter(chapter_id: str):
    try:
        from db import delete_chapter, get_chapter_by_id
        # Fetch chapter first to know its file path
        chapter = get_chapter_by_id(chapter_id)
        success = delete_chapter(chapter_id)
        if not success:
            return jsonify({"success": False, "error": "Chapter not found"}), 404

        # Attempt filesystem cleanup if we have a stored file_path
        try:
            if chapter and chapter.get('file_path'):
                fp = chapter['file_path']  # expected like /library/<series>/<chapterFolder>/<file>.html
                fp_clean = fp.split('?')[0].split('#')[0]
                if fp_clean.startswith('/library/'):
                    parts = fp_clean.strip('/').split('/')  # ['library', seriesId, chapterFolder, file]
                    if len(parts) >= 4:
                        # Reconstruct chapter directory path relative to library root
                        series_id = parts[1]
                        chapter_folder = parts[2]
                        # Backend mount path for shared library (see docker-compose): /app/shared/library
                        shared_library_root = os.path.abspath(os.path.join(os.path.dirname(__file__), 'shared', 'library'))
                        chapter_dir = os.path.join(shared_library_root, series_id, chapter_folder)
                        if chapter_dir.startswith(shared_library_root):
                            if os.path.isdir(chapter_dir):
                                import shutil
                                shutil.rmtree(chapter_dir, ignore_errors=True)
                                logger.info(f"Removed chapter directory: {chapter_dir}")
                        else:
                            logger.warning(f"Skip deleting chapter dir outside shared root: {chapter_dir}")
        except Exception as ce:
            logger.warning(f"Chapter file cleanup failed for {chapter_id}: {ce}")

        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Delete chapter error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== ORPHAN CHAPTER DIRECTORY MAINTENANCE =====
@app.route('/maintenance/orphans', methods=['GET'])
@log_endpoint_access
def list_orphan_chapter_dirs():
    """Enumerate chapter directories on disk that have no corresponding DB chapter row.
    Returns size and file counts so user can decide on cleanup.
    """
    try:
        orphans = _find_orphan_chapter_dirs()
        payload = [
            {
                'series_id': o.series_id,
                'chapter_folder': o.chapter_folder,
                'rel_path': o.rel_path,
                'size_bytes': o.size_bytes,
                'file_count': o.file_count,
                'kind': getattr(o, 'kind', 'chapter'),
            }
            for o in orphans
        ]
        return jsonify({'success': True, 'orphans': payload, 'count': len(payload)})
    except Exception as e:
        logger.error(f"List orphan dirs error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/maintenance/orphans/<series_id>', methods=['DELETE'])
@app.route('/maintenance/orphans/<series_id>/<path:chapter_folder>', methods=['DELETE'])
@log_endpoint_access
def delete_orphan_chapter_dir(series_id: str, chapter_folder: str = ''):
    """Delete an orphaned chapter directory or entire series directory.
    
    If chapter_folder is empty/not provided: deletes entire series directory
    If chapter_folder is provided: deletes specific chapter directory
    
    FIXED: Now handles both URL patterns correctly:
    - /maintenance/orphans/<series_id> (for series deletion)
    - /maintenance/orphans/<series_id>/<chapter_folder> (for chapter deletion)
    """
    try:
        # Safety: ensure clean names (no path traversal)
        if any(sep in series_id for sep in ('..', '/', '\\')):
            return jsonify({'success': False, 'error': 'Invalid series_id'}), 400
        
        if chapter_folder and any(sep in chapter_folder for sep in ('..', '/', '\\')):
            return jsonify({'success': False, 'error': 'Invalid chapter_folder'}), 400
        
        existing_pairs = _gather_existing_chapter_dir_pairs()
        
        if chapter_folder:  # Deleting specific chapter
            if (series_id, chapter_folder) in existing_pairs:
                return jsonify({
                    'success': False, 
                    'error': 'Chapter is referenced in database; not an orphan'
                }), 409
            target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id, chapter_folder)
            deleted_path = f'/library/{series_id}/{chapter_folder}'
        else:  # Deleting entire series
            # Ensure NO chapters from this series exist in DB
            if any(pair[0] == series_id for pair in existing_pairs):
                return jsonify({
                    'success': False, 
                    'error': 'Series contains active chapters in database; cannot delete'
                }), 409
            target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
            deleted_path = f'/library/{series_id}'
        
        # Validate path is within library root (security check)
        if not target_dir.startswith(SHARED_LIBRARY_ROOT):
            return jsonify({'success': False, 'error': 'Invalid path'}), 400
        
        if not os.path.isdir(target_dir):
            return jsonify({'success': False, 'error': 'Directory not found'}), 404
        
        # Attempt deletion with better error handling
        import shutil
        try:
            shutil.rmtree(target_dir)
            logger.info(f"Successfully deleted orphan directory: {target_dir}")
            return jsonify({'success': True, 'deleted': deleted_path})
        except PermissionError as pe:
            logger.error(f"Permission denied deleting {target_dir}: {pe}")
            return jsonify({
                'success': False, 
                'error': 'Permission denied - check file ownership in Docker container'
            }), 500
        except Exception as de:
            logger.error(f"Failed to delete {target_dir}: {de}")
            return jsonify({
                'success': False, 
                'error': f'Deletion failed: {str(de)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Delete orphan dir error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ===== BROKEN REFERENCES DETECTION =====
@dataclass
class BrokenReference:
    series_id: str
    series_title: str
    chapter_id: str | None
    chapter_number: int | None
    file_path: str
    issue_type: str  # 'missing_series_dir', 'missing_chapter_file', 'series_no_files'

def _find_broken_references() -> list[BrokenReference]:
    """Find database records pointing to non-existent files.
    
    Returns:
    - Series with chapters but all chapter files are missing
    - Individual chapters with missing files
    """
    from db import get_series, get_chapters
    
    broken: list[BrokenReference] = []
    all_series = get_series()
    all_chapters = get_chapters()
    
    for series in all_series:
        series_id = series['id']
        series_title = series.get('title', 'Unknown')
        series_chapters = [c for c in all_chapters if c['series_id'] == series_id]
        
        if not series_chapters:
            # Series has no chapters - not a broken reference, just empty
            continue
        
        # Check each chapter's file
        missing_files = []
        for chapter in series_chapters:
            file_path = chapter.get('file_path', '')
            if not file_path:
                continue
            
            # Convert DB path to backend filesystem path
            if file_path.startswith('/library/'):
                backend_path = os.path.join('/app/shared', file_path.lstrip('/'))
            else:
                backend_path = os.path.join('/app/shared/library', file_path.lstrip('/'))
            
            if not os.path.exists(backend_path):
                missing_files.append(chapter)
                broken.append(BrokenReference(
                    series_id=series_id,
                    series_title=series_title,
                    chapter_id=chapter['id'],
                    chapter_number=chapter.get('chapter_number'),
                    file_path=file_path,
                    issue_type='missing_chapter_file'
                ))
        
        # If ALL chapters have missing files, also add series-level broken reference
        if missing_files and len(missing_files) == len(series_chapters):
            broken.append(BrokenReference(
                series_id=series_id,
                series_title=series_title,
                chapter_id=None,
                chapter_number=None,
                file_path=f'/library/{series_id}',
                issue_type='series_no_files'
            ))
    
    return broken


@app.route('/maintenance/broken-references', methods=['GET'])
@log_endpoint_access
def list_broken_references():
    """List all database records pointing to non-existent files."""
    try:
        broken = _find_broken_references()
        
        # Group by series for better UI display
        by_series: dict[str, dict] = {}
        for ref in broken:
            if ref.series_id not in by_series:
                by_series[ref.series_id] = {
                    'series_id': ref.series_id,
                    'series_title': ref.series_title,
                    'broken_chapters': [],
                    'all_files_missing': False
                }
            
            if ref.issue_type == 'series_no_files':
                by_series[ref.series_id]['all_files_missing'] = True
            elif ref.issue_type == 'missing_chapter_file' and ref.chapter_id:
                by_series[ref.series_id]['broken_chapters'].append({
                    'chapter_id': ref.chapter_id,
                    'chapter_number': ref.chapter_number,
                    'file_path': ref.file_path
                })
        
        payload = list(by_series.values())
        return jsonify({
            'success': True, 
            'broken_references': payload, 
            'count': len(payload)
        })
    except Exception as e:
        logger.error(f"List broken references error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/maintenance/broken-references/<series_id>', methods=['DELETE'])
@log_endpoint_access
def delete_broken_reference_series(series_id: str):
    """Delete a series and all its chapters from database when files are missing.
    
    This only deletes database records - no filesystem operations.
    Use this when chapter files are gone but DB records remain.
    """
    try:
        from db import delete_series, get_series_by_id, get_chapters
        
        # Verify series exists
        series = get_series_by_id(series_id)
        if not series:
            return jsonify({'success': False, 'error': 'Series not found'}), 404
        
        # Get chapters for this series
        chapters = [c for c in get_chapters() if c['series_id'] == series_id]
        
        # Delete series (should cascade to chapters and progress)
        success = delete_series(series_id)
        if not success:
            return jsonify({'success': False, 'error': 'Failed to delete series'}), 500
        
        logger.info(f"Deleted broken reference series: {series_id} ({series.get('title')}) with {len(chapters)} chapters")
        return jsonify({
            'success': True, 
            'deleted_series_id': series_id,
            'deleted_chapters_count': len(chapters)
        })
        
    except Exception as e:
        logger.error(f"Delete broken reference series error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ===== READING PROGRESS ENDPOINTS =====
@app.route('/progress', methods=['GET'])
@log_endpoint_access
def list_progress():
    try:
        from db import get_reading_progress
        series_id = request.args.get('series_id')
        progress = get_reading_progress(series_id)
        return jsonify({"success": True, "progress": progress})
    except Exception as e:
        logger.error(f"List progress error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/progress/chapter/<chapter_id>', methods=['GET'])
@log_endpoint_access
def fetch_chapter_progress(chapter_id: str):
    try:
        from db import get_chapter_progress
        progress = get_chapter_progress(chapter_id)
        return jsonify({"success": True, "progress": progress})
    except Exception as e:
        logger.error(f"Get chapter progress error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/progress', methods=['POST'])
@log_endpoint_access
def update_progress():
    try:
        from db import upsert_reading_progress
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["series_id", "chapter_id", "current_page", "total_pages", "percentage", "last_read_date"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        upsert_reading_progress(data)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Update progress error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== BOOKMARK ENDPOINTS =====
@app.route('/bookmarks', methods=['GET'])
@log_endpoint_access
def list_bookmarks():
    try:
        from db import get_bookmarks
        series_id = request.args.get('series_id')
        chapter_id = request.args.get('chapter_id')
        bookmarks = get_bookmarks(series_id, chapter_id)
        return jsonify({"success": True, "bookmarks": bookmarks})
    except Exception as e:
        logger.error(f"List bookmarks error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/bookmarks', methods=['POST'])
@log_endpoint_access
def create_bookmark():
    try:
        from db import insert_bookmark
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["id", "series_id", "chapter_id", "page_number", "timestamp"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        insert_bookmark(data)
        return jsonify({"success": True, "id": data["id"]}), 201
    except Exception as e:
        logger.error(f"Create bookmark error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/bookmarks/<bookmark_id>', methods=['DELETE'])
@log_endpoint_access
def remove_bookmark(bookmark_id: str):
    try:
        from db import delete_bookmark
        success = delete_bookmark(bookmark_id)
        if not success:
            return jsonify({"success": False, "error": "Bookmark not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Delete bookmark error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== READING SESSION ENDPOINTS =====
@app.route('/sessions', methods=['GET'])
@log_endpoint_access
def list_sessions():
    try:
        from db import get_reading_sessions
        series_id = request.args.get('series_id')
        sessions = get_reading_sessions(series_id)
        return jsonify({"success": True, "sessions": sessions})
    except Exception as e:
        logger.error(f"List sessions error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/sessions', methods=['POST'])
@log_endpoint_access
def create_session():
    try:
        from db import insert_reading_session
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["id", "start_time"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        insert_reading_session(data)
        return jsonify({"success": True, "id": data["id"]}), 201
    except Exception as e:
        logger.error(f"Create session error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/sessions/<session_id>', methods=['PUT'])
@log_endpoint_access
def update_session_endpoint(session_id: str):
    try:
        from db import update_reading_session
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        success = update_reading_session(session_id, data)
        if not success:
            return jsonify({"success": False, "error": "Session not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Update session error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== SRS ENDPOINTS =====
@app.route('/srs/reviews', methods=['GET'])
@log_endpoint_access
def list_srs_reviews():
    try:
        from db import get_all_srs_reviews
        # Optional pagination & incremental sync
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)
        changed_since = request.args.get('changed_since', type=int)
        reviews = get_all_srs_reviews(limit=limit, offset=offset, changed_since=changed_since)
        return jsonify({"success": True, "reviews": reviews, "paging": {"limit": limit, "offset": offset, "changed_since": changed_since}})
    except Exception as e:
        logger.error(f"List SRS reviews error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/reviews/<card_id>', methods=['GET'])
@log_endpoint_access
def get_srs_review(card_id: str):
    try:
        from db import get_srs_review
        review = get_srs_review(card_id)
        return jsonify({"success": True, "review": review})
    except Exception as e:
        logger.error(f"Get SRS review error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/reviews', methods=['POST'])
@log_endpoint_access
def create_or_update_srs_review():
    try:
        from db import upsert_srs_review
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["card_id", "interval_days", "ease_factor", "repetition", "next_review", "last_review", "difficulty"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        upsert_srs_review(data)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Upsert SRS review error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/srs/review', methods=['POST'])
@log_endpoint_access
def process_srs_review():
    """Process a single review action using server-side algorithm.
    Expects JSON: { card_id: str, difficulty: int } where difficulty is UI scale:
      1=Again(incorrect), 2=Hard(correct), 3=Good(correct), 4=Easy(correct)
    We map to backend algorithm scale where values <=3 are correct and >3 incorrect by:
      ui 1 -> backend 4 (incorrect)
      ui 2 -> backend 3 (correct hard)
      ui 3 -> backend 2 (correct good)
      ui 4 -> backend 1 (correct easy)
    Returns updated review record.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400
        card_id = data.get('card_id')
        difficulty_ui = data.get('difficulty')
        if not card_id:
            return jsonify({"success": False, "error": "Missing field: card_id"}), 400
        if difficulty_ui is None:
            return jsonify({"success": False, "error": "Missing field: difficulty"}), 400
        try:
            difficulty_ui = int(difficulty_ui)
        except ValueError:
            return jsonify({"success": False, "error": "Invalid difficulty"}), 400

        def map_ui_to_backend(d: int) -> int:
            if d == 1: return 4
            if d == 2: return 3
            if d == 3: return 2
            if d == 4: return 1
            return 2

        backend_difficulty = map_ui_to_backend(difficulty_ui)
        from services import SRSService
        review = SRSService.review_card(card_id, backend_difficulty)
        # Enrich response: include human readable next review and server timestamp
        now_ms = int(time.time() * 1000)
        next_delta_ms = review['next_review'] - now_ms if review.get('next_review') else None
        if next_delta_ms is not None and next_delta_ms < 0:
            next_delta_ms = 0
        return jsonify({
            "success": True,
            "review": review,
            "meta": {
                "server_time": now_ms,
                "next_review_in_ms": next_delta_ms
            }
        })
    except Exception as e:
        logger.error(f"Process SRS review error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/due', methods=['GET'])
@log_endpoint_access
def list_cards_due():
    try:
        from db import get_cards_due_for_review, get_srs_review, get_flashcards
        from services import SRSService
        limit = int(request.args.get('limit', 20))
        cards = get_cards_due_for_review(limit)
        if not cards:
            # Lazy backfill: seed SRS records for recent flashcards if none exist
            try:
                recent = get_flashcards(limit)
                seeded = 0
                for fc in recent:
                    if not get_srs_review(fc["id"]):
                        SRSService.initialize_card(fc["id"])
                        seeded += 1
                        if seeded >= limit:
                            break
                if seeded > 0:
                    cards = get_cards_due_for_review(limit)
            except Exception as bf:
                logger.warning(f"SRS due backfill failed: {bf}")
        return jsonify({"success": True, "cards": cards})
    except Exception as e:
        logger.error(f"List cards due error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/stats', methods=['GET'])
@log_endpoint_access
def fetch_srs_stats():
    try:
        from db import get_srs_stats
        stats = get_srs_stats()
        return jsonify({"success": True, "stats": stats})
    except Exception as e:
        logger.error(f"Get SRS stats error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/srs/streak', methods=['GET'])
@log_endpoint_access
def fetch_srs_streak():
    """Return current review streak (consecutive days with >=1 correct review)."""
    try:
        from db import get_srs_streak
        streak_info = get_srs_streak()
        return jsonify({"success": True, **streak_info})
    except Exception as e:
        logger.error(f"Get SRS streak error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/preview', methods=['POST'])
@log_endpoint_access
def preview_srs_review():
    """Preview the result of a review without committing changes.
    Body: { card_id: str, difficulty: int }
    """
    try:
        from services import SRSService
        data = request.get_json() or {}
        card_id = data.get('card_id')
        difficulty = data.get('difficulty')
        if card_id is None or difficulty is None:
            return jsonify({"success": False, "error": "Missing card_id or difficulty"}), 400
        if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:
            return jsonify({"success": False, "error": "difficulty must be int 1-5"}), 400
        preview = SRSService.preview_review(card_id, difficulty)
        return jsonify({"success": True, "preview": preview, "meta": {"server_time": int(time.time() * 1000)}})
    except Exception as e:
        logger.error(f"Preview SRS review error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/stats', methods=['POST'])
@log_endpoint_access
def update_srs_stats_endpoint():
    try:
        from db import update_srs_stats
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        total_reviews_delta = data.get('total_reviews_delta', 0)
        correct_answers_delta = data.get('correct_answers_delta', 0)
        
        update_srs_stats(total_reviews_delta, correct_answers_delta)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Update SRS stats error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/settings', methods=['GET'])
@log_endpoint_access
def get_srs_settings():
    """Get current SRS algorithm settings"""
    try:
        from db import get_srs_settings
        settings = get_srs_settings()
        return jsonify({"success": True, "settings": settings})
    except Exception as e:
        logger.error(f"Get SRS settings error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/settings', methods=['POST'])
@log_endpoint_access
def update_srs_settings():
    """Update SRS algorithm settings"""
    try:
        from db import update_srs_settings
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        # Validate required fields and ranges
        validation_errors = []
        
        # Validate ease factor bounds
        min_ease = data.get('min_ease_factor')
        max_ease = data.get('max_ease_factor')
        if min_ease is not None and max_ease is not None and min_ease >= max_ease:
            validation_errors.append("Minimum ease factor must be less than maximum ease factor")
        
        if min_ease is not None and (min_ease < 1.0 or min_ease > 3.0):
            validation_errors.append("Minimum ease factor must be between 1.0 and 3.0")
            
        if max_ease is not None and (max_ease < 1.0 or max_ease > 5.0):
            validation_errors.append("Maximum ease factor must be between 1.0 and 5.0")
        
        # Validate intervals
        initial_interval = data.get('initial_interval')
        if initial_interval is not None and initial_interval < 1:
            validation_errors.append("Initial interval must be at least 1 day")
            
        second_interval = data.get('second_interval')
        if second_interval is not None and second_interval < 1:
            validation_errors.append("Second interval must be at least 1 day")
            
        max_interval = data.get('max_interval')
        if max_interval is not None and max_interval < 1:
            validation_errors.append("Maximum interval must be at least 1 day")
        
        # Validate difficulty settings
        correct_threshold = data.get('correct_threshold')
        max_difficulty = data.get('max_difficulty')
        if correct_threshold is not None and max_difficulty is not None and correct_threshold >= max_difficulty:
            validation_errors.append("Correct threshold must be less than maximum difficulty")
        
        if validation_errors:
            return jsonify({"success": False, "errors": validation_errors}), 400

        settings = update_srs_settings(data)
        return jsonify({"success": True, "settings": settings})
    except Exception as e:
        logger.error(f"Update SRS settings error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/srs/settings/reset', methods=['POST'])
@log_endpoint_access
def reset_srs_settings():
    """Reset SRS settings to defaults"""
    try:
        from db import reset_srs_settings_to_defaults
        settings = reset_srs_settings_to_defaults()
        return jsonify({"success": True, "settings": settings})
    except Exception as e:
        logger.error(f"Reset SRS settings error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== USER PREFERENCES ENDPOINTS =====
@app.route('/preferences', methods=['GET'])
@log_endpoint_access
def list_preferences():
    try:
        from db import get_all_user_preferences
        preferences = get_all_user_preferences()
        return jsonify({"success": True, "preferences": preferences})
    except Exception as e:
        logger.error(f"List preferences error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/preferences/<key>', methods=['GET'])
@log_endpoint_access
def fetch_preference(key: str):
    try:
        from db import get_user_preference
        value = get_user_preference(key)
        return jsonify({"success": True, "value": value})
    except Exception as e:
        logger.error(f"Get preference error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/preferences', methods=['POST'])
@log_endpoint_access
def set_preference():
    try:
        from db import set_user_preference
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        if 'key' not in data or 'value' not in data:
            return jsonify({"success": False, "error": "Missing key or value"}), 400

        set_user_preference(data['key'], data['value'])
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Set preference error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== VOCABULARY ENDPOINTS =====
@app.route('/vocabulary', methods=['GET'])
@log_endpoint_access
def list_vocabulary():
    try:
        from db import get_vocabulary_history
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        vocabulary = get_vocabulary_history(date_from, date_to)
        return jsonify({"success": True, "vocabulary": vocabulary})
    except Exception as e:
        logger.error(f"List vocabulary error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/vocabulary', methods=['POST'])
@log_endpoint_access
def add_vocabulary():
    try:
        from db import insert_vocabulary_entry
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing JSON body"}), 400

        required = ["word", "date_learned", "timestamp"]
        for field in required:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing field: {field}"}), 400

        insert_vocabulary_entry(data)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Add vocabulary error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ===== ADMIN/DATABASE INSPECTION ENDPOINTS =====
@app.route('/admin/database/schema', methods=['GET'])
@log_endpoint_access
def get_database_schema():
    """Get database schema information including table structures and relationships."""
    try:
        from db import get_conn
        conn = get_conn()
        cur = conn.cursor()
        
        # Get all table names
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        
        schema_info = {}
        
        for table in tables:
            # Get table info (columns, types, etc.)
            cur.execute(f"PRAGMA table_info({table})")
            columns = cur.fetchall()
            
            # Get foreign keys
            cur.execute(f"PRAGMA foreign_key_list({table})")
            foreign_keys = cur.fetchall()
            
            # Get row count
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            row_count = cur.fetchone()[0]
            
            schema_info[table] = {
                "columns": [
                    {
                        "cid": col[0],
                        "name": col[1],
                        "type": col[2],
                        "not_null": bool(col[3]),
                        "default_value": col[4],
                        "primary_key": bool(col[5])
                    }
                    for col in columns
                ],
                "foreign_keys": [
                    {
                        "id": fk[0],
                        "seq": fk[1],
                        "table": fk[2],
                        "from": fk[3],
                        "to": fk[4],
                        "on_update": fk[5],
                        "on_delete": fk[6]
                    }
                    for fk in foreign_keys
                ],
                "row_count": row_count
            }
        
        return jsonify({"success": True, "schema": schema_info})
    except Exception as e:
        logger.error(f"Get database schema error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/admin/database/table/<table_name>', methods=['GET'])
@log_endpoint_access
def get_table_contents(table_name: str):
    """Get contents of a specific table with pagination."""
    try:
        from db import get_conn
        
        # Validate table name to prevent SQL injection
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cur.fetchone():
            return jsonify({"success": False, "error": "Table not found"}), 404
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 1000)  # Max 1000 rows
        offset = (page - 1) * per_page
        
        # Get total count
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        total_rows = cur.fetchone()[0]
        
        # Get paginated data
        cur.execute(f"SELECT * FROM {table_name} LIMIT ? OFFSET ?", (per_page, offset))
        rows = cur.fetchall()
        
        # Convert rows to dictionaries
        data = [dict(row) for row in rows]
        
        return jsonify({
            "success": True,
            "table": table_name,
            "data": data,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_rows": total_rows,
                "total_pages": (total_rows + per_page - 1) // per_page
            }
        })
    except Exception as e:
        logger.error(f"Get table contents error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/admin/database/stats', methods=['GET'])
@log_endpoint_access
def get_database_stats():
    """Get overall database statistics."""
    try:
        from db import get_conn
        import os
        import sqlite3
        
        conn = get_conn()
        cur = conn.cursor()
        
        # Get database file size
        db_path = os.environ.get("FLASHCARDS_DB_PATH") or os.path.join(
            os.path.dirname(__file__), "data", "flashcards.db"
        )
        db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
        
        # Get table counts
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        
        table_stats = {}
        total_records = 0
        
        for table in tables:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            table_stats[table] = count
            total_records += count
        
        # Get database version/info
        cur.execute("PRAGMA user_version")
        user_version = cur.fetchone()[0]
        
        cur.execute("PRAGMA page_count")
        page_count = cur.fetchone()[0]
        
        cur.execute("PRAGMA page_size")
        page_size = cur.fetchone()[0]
        
        return jsonify({
            "success": True,
            "stats": {
                "database_size_bytes": db_size,
                "database_size_mb": round(db_size / (1024 * 1024), 2),
                "total_tables": len(tables),
                "total_records": total_records,
                "table_counts": table_stats,
                "sqlite_version": sqlite3.sqlite_version,
                "user_version": user_version,
                "page_count": page_count,
                "page_size": page_size,
                "database_path": db_path
            }
        })
    except Exception as e:
        logger.error(f"Get database stats error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/admin/database/export/<table_name>', methods=['GET'])
@log_endpoint_access
def export_table_csv(table_name):
    """Export table data as CSV file."""
    try:
        from db import get_conn
        import csv
        import io
        from flask import make_response
        
        conn = get_conn()
        cur = conn.cursor()
        
        # Validate table exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cur.fetchone():
            return jsonify({"success": False, "error": "Table not found"}), 404
        
        # Get all data from table
        cur.execute(f"SELECT * FROM {table_name}")
        rows = cur.fetchall()
        
        # Get column names
        cur.execute(f"PRAGMA table_info({table_name})")
        columns = [col[1] for col in cur.fetchall()]
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(columns)
        
        # Write data rows
        for row in rows:
            writer.writerow(row)
        
        # Create response
        csv_data = output.getvalue()
        response = make_response(csv_data)
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = f'attachment; filename={table_name}.csv'
        
        return response
        
    except Exception as e:
        logger.error(f"Export table error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/admin/database/backup', methods=['GET'])
@log_endpoint_access
def backup_database():
    """Download complete database file."""
    try:
        from flask import send_file
        import os
        
        db_path = os.environ.get("FLASHCARDS_DB_PATH") or os.path.join(
            os.path.dirname(__file__), "data", "flashcards.db"
        )
        
        if not os.path.exists(db_path):
            return jsonify({"success": False, "error": "Database file not found"}), 404
        
        return send_file(
            db_path,
            as_attachment=True,
            download_name=f'flashcards_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db',
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        logger.error(f"Database backup error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/admin/database/integrity', methods=['GET'])
@log_endpoint_access
def check_database_integrity():
    """Run SQLite integrity check."""
    try:
        from db import get_conn
        
        conn = get_conn()
        cur = conn.cursor()
        
        # Run integrity check
        cur.execute("PRAGMA integrity_check")
        results = cur.fetchall()
        
        # Format results
        if len(results) == 1 and results[0][0] == 'ok':
            result_text = "✅ Database integrity check passed - no issues found"
        else:
            issues = [row[0] for row in results]
            result_text = f"⚠️ Database integrity issues found:\n" + "\n".join(f"• {issue}" for issue in issues)
        
        return jsonify({
            "success": True,
            "result": result_text,
            "issues_found": len(results) > 1 or (len(results) == 1 and results[0][0] != 'ok')
        })
        
    except Exception as e:
        logger.error(f"Integrity check error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    logger.info("Starting Translation Backend Server...")
    logger.info(f"OpenAI API Key configured: {'Yes' if Config.OPENAI_API_KEY else 'No'}")
    logger.info(f"DeepL API Key configured: {'Yes' if Config.DEEPL_API_KEY else 'No'}")
    
    # Run in development mode with auto-reload
    app.run(host='0.0.0.0', port=5000, debug=True)