# Translation Backend

A Flask-based backend service that provides Japanese text translation using OpenAI ChatGPT and DeepL APIs.

## Features

- **OpenAI ChatGPT Integration**: Natural language translation with context awareness
- **DeepL API Integration**: Professional-grade translation service
- **Comparison Mode**: Get translations from both providers to compare results
- **CORS Enabled**: Ready for frontend integration
- **Error Handling**: Robust error handling and logging

## API Endpoints

### Health Check
```
GET /health
```
Returns service status.

### Single Translation
```
POST /translate
Content-Type: application/json

{
  "text": "こんにちは",
  "provider": "openai",  // or "deepl"
  "source_lang": "Japanese",  // "JA" for DeepL
  "target_lang": "English"     // "EN" for DeepL
}
```

### Compare Translations
```
POST /translate/compare
Content-Type: application/json

{
  "text": "こんにちは"
}
```
Returns translations from both OpenAI and DeepL for comparison.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:5000`

## Configuration

API keys are configured directly in the code:
- OpenAI API Key and Organization ID
- DeepL API Key

## Usage Examples

### Test with curl:

**Health check:**
```bash
curl http://localhost:5000/health
```

**Translate with OpenAI:**
```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは", "provider": "openai"}'
```

**Translate with DeepL:**
```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは", "provider": "deepl"}'
```

**Compare translations:**
```bash
curl -X POST http://localhost:5000/translate/compare \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは"}'
```