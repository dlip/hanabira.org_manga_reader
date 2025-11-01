"""
Backend service classes that encapsulate business logic for content management,
SRS, and analytics. These mirror the frontend managers but operate on the database.
"""

import time
from typing import Dict, List, Optional, Any
from db import (
    # Series operations
    insert_series, get_series, get_series_by_id, update_series, delete_series,
    # Chapter operations  
    insert_chapter, get_chapters, get_chapter_by_id, update_chapter, delete_chapter,
    # Progress operations
    upsert_reading_progress, get_reading_progress, get_chapter_progress,
    # Bookmark operations
    insert_bookmark, get_bookmarks, delete_bookmark,
    # Session operations
    insert_reading_session, get_reading_sessions, update_reading_session,
    # SRS operations
    upsert_srs_review, get_srs_review, get_all_srs_reviews, get_cards_due_for_review,
    update_srs_stats, get_srs_stats,
    # Preferences and vocabulary
    set_user_preference, get_user_preference, get_all_user_preferences,
    insert_vocabulary_entry, get_vocabulary_history,
    # Flashcards and SRS cleanup helpers
    get_flashcard as db_get_flashcard,
    delete_flashcard as db_delete_flashcard,
    get_srs_review as db_get_srs_review,
    upsert_srs_review as db_upsert_srs_review,
    # add direct delete for srs review
    
)
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
from db import delete_srs_review as db_delete_srs_review


class ContentService:
    """Service for managing manga series, chapters, progress, bookmarks, and reading sessions."""
    
    # Series Management
    @staticmethod
    def create_series(title: str, author: str = None, description: str = None, 
                     cover_image: str = None, total_chapters: int = None, 
                     genre: List[str] = None, status: str = 'ongoing') -> Dict[str, Any]:
        """Create a new manga series."""
        series_id = f"series_{int(time.time() * 1000)}_{time.time_ns() % 1000000}"
        
        series_data = {
            "id": series_id,
            "title": title,
            "author": author,
            "description": description,
            "cover_image": cover_image,
            "total_chapters": total_chapters,
            "genre": ",".join(genre) if genre else None,
            "status": status,
            "added_date": int(time.time() * 1000),
            "last_read_date": None
        }
        
        insert_series(series_data)
        return series_data
    
    @staticmethod
    def list_series() -> List[Dict[str, Any]]:
        """Get all series."""
        series_list = get_series()
        # Convert genre string back to array
        for series in series_list:
            if series.get("genre"):
                series["genre"] = series["genre"].split(",")
            else:
                series["genre"] = []
        return series_list
    
    @staticmethod
    def get_series_by_id(series_id: str) -> Optional[Dict[str, Any]]:
        """Get series by ID."""
        series = get_series_by_id(series_id)
        if series and series.get("genre"):
            series["genre"] = series["genre"].split(",")
        elif series:
            series["genre"] = []
        return series
    
    @staticmethod
    def update_series_data(series_id: str, updates: Dict[str, Any]) -> bool:
        """Update series data."""
        if "genre" in updates and isinstance(updates["genre"], list):
            updates["genre"] = ",".join(updates["genre"])
        return update_series(series_id, updates)
    
    @staticmethod
    def remove_series(series_id: str) -> bool:
        """Delete series and all related data."""
        return delete_series(series_id)
    
    # Chapter Management
    @staticmethod
    def create_chapter(series_id: str, chapter_number: int, title: str = None,
                      file_path: str = "", page_count: int = None) -> Dict[str, Any]:
        """Create a new chapter."""
        chapter_id = f"chapter_{int(time.time() * 1000)}_{time.time_ns() % 1000000}"
        
        chapter_data = {
            "id": chapter_id,
            "series_id": series_id,
            "chapter_number": chapter_number,
            "title": title,
            "file_path": file_path,
            "page_count": page_count,
            "added_date": int(time.time() * 1000)
        }
        
        insert_chapter(chapter_data)
        return chapter_data
    
    @staticmethod
    def list_chapters(series_id: str = None) -> List[Dict[str, Any]]:
        """Get chapters, optionally filtered by series."""
        return get_chapters(series_id)
    
    @staticmethod
    def get_chapter_by_id(chapter_id: str) -> Optional[Dict[str, Any]]:
        """Get chapter by ID."""
        return get_chapter_by_id(chapter_id)
    
    @staticmethod
    def update_chapter_data(chapter_id: str, updates: Dict[str, Any]) -> bool:
        """Update chapter data."""
        return update_chapter(chapter_id, updates)
    
    @staticmethod
    def remove_chapter(chapter_id: str) -> bool:
        """Delete chapter and related data."""
        return delete_chapter(chapter_id)
    
    # Reading Progress Management
    @staticmethod
    def update_reading_progress(series_id: str, chapter_id: str, current_page: int,
                               total_pages: int, is_completed: bool = False) -> Dict[str, Any]:
        """Update reading progress for a chapter."""
        percentage = (current_page / total_pages * 100) if total_pages > 0 else 0
        
        progress_data = {
            "series_id": series_id,
            "chapter_id": chapter_id,
            "current_page": current_page,
            "total_pages": total_pages,
            "percentage": percentage,
            "last_read_date": int(time.time() * 1000),
            "is_completed": is_completed
        }
        
        upsert_reading_progress(progress_data)
        
        # Update series last read date
        update_series(series_id, {"last_read_date": int(time.time() * 1000)})
        
        return progress_data
    
    @staticmethod
    def get_progress(series_id: str = None) -> List[Dict[str, Any]]:
        """Get reading progress."""
        return get_reading_progress(series_id)
    
    @staticmethod
    def get_chapter_progress_data(chapter_id: str) -> Optional[Dict[str, Any]]:
        """Get progress for a specific chapter."""
        return get_chapter_progress(chapter_id)
    
    # Bookmark Management
    @staticmethod
    def create_bookmark(series_id: str, chapter_id: str, page_number: int,
                       title: str = None, note: str = None, screenshot: str = None) -> Dict[str, Any]:
        """Create a new bookmark."""
        bookmark_id = f"bookmark_{int(time.time() * 1000)}_{time.time_ns() % 1000000}"
        
        bookmark_data = {
            "id": bookmark_id,
            "series_id": series_id,
            "chapter_id": chapter_id,
            "page_number": page_number,
            "title": title,
            "note": note,
            "timestamp": int(time.time() * 1000),
            "screenshot": screenshot
        }
        
        insert_bookmark(bookmark_data)
        return bookmark_data
    
    @staticmethod
    def list_bookmarks(series_id: str = None, chapter_id: str = None) -> List[Dict[str, Any]]:
        """Get bookmarks."""
        return get_bookmarks(series_id, chapter_id)
    
    @staticmethod
    def remove_bookmark(bookmark_id: str) -> bool:
        """Delete bookmark."""
        return delete_bookmark(bookmark_id)
    
    # Reading Session Management
    @staticmethod
    def start_reading_session(series_id: str = None, chapter_id: str = None) -> Dict[str, Any]:
        """Start a new reading session."""
        session_id = f"session_{int(time.time() * 1000)}_{time.time_ns() % 1000000}"
        
        session_data = {
            "id": session_id,
            "series_id": series_id,
            "chapter_id": chapter_id,
            "start_time": int(time.time() * 1000),
            "end_time": None,
            "pages_read": 0,
            "words_learned": 0,
            "flashcards_created": 0,
            "characters_read": 0,
            "words_looked_up": 0,
            "date": time.strftime("%Y-%m-%d")
        }
        
        insert_reading_session(session_data)
        return session_data
    
    @staticmethod
    def end_reading_session(session_id: str, pages_read: int = 0, words_learned: int = 0,
                           flashcards_created: int = 0, characters_read: int = 0,
                           words_looked_up: int = 0) -> bool:
        """End reading session with stats."""
        updates = {
            "end_time": int(time.time() * 1000),
            "pages_read": pages_read,
            "words_learned": words_learned,
            "flashcards_created": flashcards_created,
            "characters_read": characters_read,
            "words_looked_up": words_looked_up
        }
        
        return update_reading_session(session_id, updates)
    
    @staticmethod
    def update_session_stats(session_id: str, **stats) -> bool:
        """Update session statistics."""
        return update_reading_session(session_id, stats)
    
    @staticmethod
    def list_reading_sessions(series_id: str = None) -> List[Dict[str, Any]]:
        """Get reading sessions."""
        return get_reading_sessions(series_id)
    
    @staticmethod
    def get_series_analytics(series_id: str) -> Dict[str, Any]:
        """Get analytics for a series."""
        sessions = get_reading_sessions(series_id)
        progress = get_reading_progress(series_id)
        bookmarks = get_bookmarks(series_id)
        chapters = get_chapters(series_id)
        
        # Calculate stats
        completed_sessions = [s for s in sessions if s.get("end_time")]
        total_reading_time = sum((s["end_time"] - s["start_time"]) for s in completed_sessions)
        total_pages_read = sum(s.get("pages_read", 0) for s in sessions)
        average_session_time = total_reading_time / len(completed_sessions) if completed_sessions else 0
        
        completed_chapters = len([p for p in progress if p.get("is_completed")])
        completion_percentage = (completed_chapters / len(chapters) * 100) if chapters else 0
        
        return {
            "total_reading_time": total_reading_time,
            "total_sessions": len(sessions),
            "total_pages_read": total_pages_read,
            "average_session_time": average_session_time,
            "completion_percentage": completion_percentage,
            "total_bookmarks": len(bookmarks)
        }


def delete_flashcard(card_id: str) -> bool:
    """Delete a flashcard by ID, removing its image file and associated SRS review if present.

    Returns True if a flashcard row was deleted, False if not found.
    """
    # Fetch to get image path if any
    fc = db_get_flashcard(card_id)
    if not fc:
        return False

    # Delete DB row
    deleted = db_delete_flashcard(card_id)
    # Best-effort cleanup: image file
    try:
        img_rel = fc.get("image_path")
        if img_rel:
            img_abs = os.path.join(IMAGES_DIR, img_rel)
            if os.path.isfile(img_abs):
                os.remove(img_abs)
    except Exception:
        # Non-fatal
        pass

    # Best-effort cleanup: SRS review
    try:
        # Prefer to hard-delete SRS review if present
        review = db_get_srs_review(card_id)
        if review:
            db_delete_srs_review(card_id)
    except Exception:
        pass

    return deleted


class SRSService:
    """Service for managing Spaced Repetition System data."""
    
    # SRS algorithm constants
    MIN_EASE_FACTOR = 1.3
    MAX_EASE_FACTOR = 2.5
    INITIAL_EASE_FACTOR = 2.5
    INITIAL_INTERVAL = 1
    
    @staticmethod
    def initialize_card(card_id: str) -> Dict[str, Any]:
        """Initialize SRS data for a new card."""
        review_data = {
            "card_id": card_id,
            "interval_days": SRSService.INITIAL_INTERVAL,
            "ease_factor": SRSService.INITIAL_EASE_FACTOR,
            "repetition": 0,
            "next_review": int(time.time() * 1000),
            "last_review": 0,
            "difficulty": 3,
            "streak": 0
        }
        
        upsert_srs_review(review_data)
        return review_data
    
    @staticmethod
    def review_card(card_id: str, difficulty: int) -> Dict[str, Any]:
        """Process a card review using SuperMemo 2 algorithm."""
        review = get_srs_review(card_id)
        if not review:
            review = SRSService.initialize_card(card_id)
        
        now = int(time.time() * 1000)
        was_correct = difficulty <= 3  # 1-3 = correct, 4-5 = incorrect
        
        # Update streak
        if was_correct:
            review["streak"] += 1
        else:
            review["streak"] = 0
        
        # SuperMemo 2 algorithm
        if difficulty < 3:
            # Easy responses
            review["ease_factor"] = min(
                SRSService.MAX_EASE_FACTOR,
                review["ease_factor"] + (0.1 - (3 - difficulty) * (0.08 + (3 - difficulty) * 0.02))
            )
        elif difficulty > 3:
            # Hard responses
            review["ease_factor"] = max(
                SRSService.MIN_EASE_FACTOR,
                review["ease_factor"] - 0.8 - (difficulty - 4) * 0.28 - (difficulty - 4) * (difficulty - 4) * 0.02
            )
        
        if was_correct:
            if review["repetition"] == 0:
                review["interval_days"] = 1
            elif review["repetition"] == 1:
                review["interval_days"] = 6
            else:
                review["interval_days"] = int(review["interval_days"] * review["ease_factor"])
            review["repetition"] += 1
        else:
            # Reset interval on failure
            review["repetition"] = 0
            review["interval_days"] = 1
        
        review["last_review"] = now
        review["next_review"] = now + (review["interval_days"] * 24 * 60 * 60 * 1000)
        review["difficulty"] = difficulty
        
        upsert_srs_review(review)
        
        # Update global stats
        update_srs_stats(1, 1 if was_correct else 0)
        
        return review

    @staticmethod
    def preview_review(card_id: str, difficulty: int) -> Dict[str, Any]:
        """Return a predicted review state for a given difficulty WITHOUT persisting.

        Mirrors review_card algorithm but does not write to DB or update stats.
        Adds fields: predicted_interval_days, predicted_next_review, predicted_ease_factor, was_correct.
        """
        existing = get_srs_review(card_id)
        if not existing:
            existing = SRSService.initialize_card(card_id)
        # Work on a copy
        review = dict(existing)
        now = int(time.time() * 1000)
        was_correct = difficulty <= 3
        streak = review.get("streak", 0)
        if was_correct:
            streak += 1
        else:
            streak = 0

        ease = review["ease_factor"]
        interval = review["interval_days"]
        repetition = review["repetition"]

        # Ease factor adjustments (same as review_card logic)
        if difficulty < 3:
            ease = min(
                SRSService.MAX_EASE_FACTOR,
                ease + (0.1 - (3 - difficulty) * (0.08 + (3 - difficulty) * 0.02))
            )
        elif difficulty > 3:
            ease = max(
                SRSService.MIN_EASE_FACTOR,
                ease - 0.8 - (difficulty - 4) * 0.28 - (difficulty - 4) * (difficulty - 4) * 0.02
            )

        if was_correct:
            if repetition == 0:
                interval = 1
            elif repetition == 1:
                interval = 6
            else:
                interval = int(interval * ease)
            repetition += 1
        else:
            repetition = 0
            interval = 1

        predicted_next = now + interval * 24 * 60 * 60 * 1000
        return {
            "card_id": card_id,
            "predicted_interval_days": interval,
            "predicted_next_review": predicted_next,
            "predicted_ease_factor": ease,
            "predicted_repetition": repetition,
            "was_correct": was_correct,
            "difficulty": difficulty,
            "current": existing,
            "streak_if_correct": streak if was_correct else streak,
        }
    
    @staticmethod
    def get_cards_for_review(limit: int = 20) -> List[Dict[str, Any]]:
        """Get cards due for review."""
        return get_cards_due_for_review(limit)
    
    @staticmethod
    def get_card_review_data(card_id: str) -> Optional[Dict[str, Any]]:
        """Get SRS data for a card."""
        return get_srs_review(card_id)
    
    @staticmethod
    def get_all_review_data() -> List[Dict[str, Any]]:
        """Get all SRS review data."""
        return get_all_srs_reviews()
    
    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        """Get SRS statistics."""
        stats = get_srs_stats()
        reviews = get_all_srs_reviews()
        
        # Calculate derived stats
        cards_learned = len([r for r in reviews if r["repetition"] > 0])
        cards_mature = len([r for r in reviews if r["interval_days"] >= 21])
        average_ease = sum(r["ease_factor"] for r in reviews) / len(reviews) if reviews else SRSService.INITIAL_EASE_FACTOR
        accuracy = (stats["correct_answers"] / stats["total_reviews"] * 100) if stats["total_reviews"] > 0 else 0
        
        return {
            "total_reviews": stats["total_reviews"],
            "correct_answers": stats["correct_answers"],
            "accuracy": accuracy,
            "cards_learned": cards_learned,
            "cards_mature": cards_mature,
            "average_ease": average_ease
        }
    
    @staticmethod
    def get_cards_by_interval() -> Dict[str, List[str]]:
        """Categorize cards by interval."""
        reviews = get_all_srs_reviews()
        result = {"new": [], "learning": [], "mature": []}
        
        for review in reviews:
            if review["repetition"] == 0:
                result["new"].append(review["card_id"])
            elif review["interval_days"] < 21:
                result["learning"].append(review["card_id"])
            else:
                result["mature"].append(review["card_id"])
        
        return result


class AnalyticsService:
    """Service for analytics and vocabulary tracking."""
    
    @staticmethod
    def add_vocabulary_entry(word: str, reading: str = None, meaning: str = None,
                            jlpt_level: str = None) -> Dict[str, Any]:
        """Add a vocabulary entry."""
        entry_data = {
            "word": word,
            "reading": reading,
            "meaning": meaning,
            "jlpt_level": jlpt_level,
            "date_learned": time.strftime("%Y-%m-%d"),
            "timestamp": int(time.time() * 1000)
        }
        
        insert_vocabulary_entry(entry_data)
        return entry_data
    
    @staticmethod
    def get_vocabulary_stats() -> Dict[str, Any]:
        """Get vocabulary learning statistics."""
        all_vocab = get_vocabulary_history()
        today = time.strftime("%Y-%m-%d")
        
        # Calculate date ranges
        from datetime import datetime, timedelta
        today_dt = datetime.now()
        week_ago = (today_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        month_ago = (today_dt - timedelta(days=30)).strftime("%Y-%m-%d")
        
        today_vocab = [v for v in all_vocab if v["date_learned"] == today]
        week_vocab = [v for v in all_vocab if v["date_learned"] >= week_ago]
        month_vocab = [v for v in all_vocab if v["date_learned"] >= month_ago]
        
        # JLPT level counts
        jlpt_counts = {"N5": 0, "N4": 0, "N3": 0, "N2": 0, "N1": 0, "unknown": 0}
        for vocab in all_vocab:
            level = vocab.get("jlpt_level", "unknown")
            if level in jlpt_counts:
                jlpt_counts[level] += 1
            else:
                jlpt_counts["unknown"] += 1
        
        # Average per day (last 30 days)
        days_active = len(set(v["date_learned"] for v in month_vocab))
        average_per_day = len(month_vocab) / max(days_active, 1)
        
        return {
            "total_words": len(all_vocab),
            "new_words_today": len(today_vocab),
            "new_words_this_week": len(week_vocab),
            "new_words_this_month": len(month_vocab),
            "average_per_day": average_per_day,
            "jlpt_n5": jlpt_counts["N5"],
            "jlpt_n4": jlpt_counts["N4"],
            "jlpt_n3": jlpt_counts["N3"],
            "jlpt_n2": jlpt_counts["N2"],
            "jlpt_n1": jlpt_counts["N1"],
            "unknown": jlpt_counts["unknown"]
        }
    
    @staticmethod
    def get_reading_analytics() -> Dict[str, Any]:
        """Get comprehensive reading analytics."""
        sessions = get_reading_sessions()
        vocab_stats = AnalyticsService.get_vocabulary_stats()
        
        if not sessions:
            return {
                "total_reading_time": 0,
                "total_sessions": 0,
                "average_session_time": 0,
                "longest_session": 0,
                "characters_read": 0,
                "words_looked_up": 0,
                "flashcards_created": 0,
                "vocabulary_stats": vocab_stats,
                "weekly_progress": []
            }
        
        # Calculate session stats
        completed_sessions = [s for s in sessions if s.get("end_time")]
        total_reading_time = sum((s["end_time"] - s["start_time"]) / (1000 * 60) for s in completed_sessions)  # minutes
        longest_session = max((s["end_time"] - s["start_time"]) / (1000 * 60) for s in completed_sessions) if completed_sessions else 0
        average_session_time = total_reading_time / len(completed_sessions) if completed_sessions else 0
        
        characters_read = sum(s.get("characters_read", 0) for s in sessions)
        words_looked_up = sum(s.get("words_looked_up", 0) for s in sessions)
        flashcards_created = sum(s.get("flashcards_created", 0) for s in sessions)
        
        # Weekly progress (last 7 days)
        from datetime import datetime, timedelta
        weekly_progress = []
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            day_sessions = [s for s in sessions if s.get("date") == date]
            day_reading_time = sum((s.get("end_time", s["start_time"]) - s["start_time"]) / (1000 * 60) for s in day_sessions)
            day_words = sum(s.get("words_learned", 0) for s in day_sessions)
            
            weekly_progress.append({
                "date": date,
                "reading_time": day_reading_time,
                "words_learned": day_words
            })
        
        return {
            "total_reading_time": total_reading_time,
            "total_sessions": len(sessions),
            "average_session_time": average_session_time,
            "longest_session": longest_session,
            "characters_read": characters_read,
            "words_looked_up": words_looked_up,
            "flashcards_created": flashcards_created,
            "vocabulary_stats": vocab_stats,
            "weekly_progress": weekly_progress[::-1]  # Reverse to get chronological order
        }


class PreferencesService:
    """Service for managing user preferences."""
    
    @staticmethod
    def set_preference(key: str, value: Any) -> None:
        """Set a user preference."""
        import json
        value_str = json.dumps(value) if not isinstance(value, str) else value
        set_user_preference(key, value_str)
    
    @staticmethod
    def get_preference(key: str, default: Any = None) -> Any:
        """Get a user preference."""
        import json
        value = get_user_preference(key)
        if value is None:
            return default
        
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    
    @staticmethod
    def get_all_preferences() -> Dict[str, Any]:
        """Get all user preferences."""
        import json
        prefs = get_all_user_preferences()
        result = {}
        
        for key, value in prefs.items():
            try:
                result[key] = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                result[key] = value
        
        return result
    
    @staticmethod
    def bulk_set_preferences(preferences: Dict[str, Any]) -> None:
        """Set multiple preferences at once."""
        for key, value in preferences.items():
            PreferencesService.set_preference(key, value)