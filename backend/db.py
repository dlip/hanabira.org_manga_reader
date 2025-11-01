import os
import sqlite3
import time
from typing import Any, Dict, List, Optional
import threading


DB_PATH = os.environ.get("FLASHCARDS_DB_PATH") or os.path.join(
    os.path.dirname(__file__), "data", "flashcards.db"
)


def ensure_dirs() -> None:
    base_dir = os.path.dirname(DB_PATH)
    images_dir = os.path.join(os.path.dirname(__file__), "data", "images")
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)


_local = threading.local()


def get_conn() -> sqlite3.Connection:
    # Use a thread-local connection for Flask threaded server
    conn = getattr(_local, "conn", None)
    if conn is None:
        ensure_dirs()
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Enable foreign key constraints (required for CASCADE to work)
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    
    # Flashcards table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            reading TEXT,
            image_path TEXT,
            notes TEXT,
            grammar TEXT,
            tags TEXT,
            difficulty TEXT,
            timestamp INTEGER NOT NULL,
            furigana TEXT
        )
        """
    )
    
    # Series table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS series (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            description TEXT,
            cover_image TEXT,
            total_chapters INTEGER,
            genre TEXT,
            status TEXT DEFAULT 'ongoing',
            added_date INTEGER NOT NULL,
            last_read_date INTEGER
        )
        """
    )
    
    # Chapters table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chapters (
            id TEXT PRIMARY KEY,
            series_id TEXT NOT NULL,
            chapter_number INTEGER NOT NULL,
            title TEXT,
            file_path TEXT NOT NULL,
            page_count INTEGER,
            added_date INTEGER NOT NULL,
            FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE CASCADE
        )
        """
    )
    
    # Reading progress table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS reading_progress (
            series_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            current_page INTEGER NOT NULL,
            total_pages INTEGER NOT NULL,
            percentage REAL NOT NULL,
            last_read_date INTEGER NOT NULL,
            is_completed INTEGER DEFAULT 0,
            PRIMARY KEY (series_id, chapter_id),
            FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
        )
        """
    )
    
    # Bookmarks table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            series_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            title TEXT,
            note TEXT,
            timestamp INTEGER NOT NULL,
            screenshot TEXT,
            FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
        )
        """
    )
    
    # Reading sessions table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS reading_sessions (
            id TEXT PRIMARY KEY,
            series_id TEXT,
            chapter_id TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            pages_read INTEGER DEFAULT 0,
            words_learned INTEGER DEFAULT 0,
            flashcards_created INTEGER DEFAULT 0,
            characters_read INTEGER DEFAULT 0,
            words_looked_up INTEGER DEFAULT 0,
            date TEXT NOT NULL,
            FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE SET NULL,
            FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
        )
        """
    )
    
    # SRS reviews table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS srs_reviews (
            card_id TEXT PRIMARY KEY,
            interval_days INTEGER NOT NULL,
            ease_factor REAL NOT NULL,
            repetition INTEGER NOT NULL,
            next_review INTEGER NOT NULL,
            last_review INTEGER NOT NULL,
            difficulty INTEGER NOT NULL,
            streak INTEGER DEFAULT 0,
            FOREIGN KEY (card_id) REFERENCES flashcards (id) ON DELETE CASCADE
        )
        """
    )
    
    # SRS stats table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS srs_stats (
            id INTEGER PRIMARY KEY,
            total_reviews INTEGER DEFAULT 0,
            correct_answers INTEGER DEFAULT 0,
            last_updated INTEGER NOT NULL
        )
        """
    )
    
    # SRS algorithm settings table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS srs_settings (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            min_ease_factor REAL NOT NULL DEFAULT 1.3,
            max_ease_factor REAL NOT NULL DEFAULT 2.5,
            initial_ease_factor REAL NOT NULL DEFAULT 2.5,
            initial_interval INTEGER NOT NULL DEFAULT 1,
            second_interval INTEGER NOT NULL DEFAULT 6,
            max_difficulty INTEGER NOT NULL DEFAULT 5,
            correct_threshold INTEGER NOT NULL DEFAULT 3,
            easy_bonus REAL NOT NULL DEFAULT 0.1,
            easy_penalty REAL NOT NULL DEFAULT 0.08,
            easy_penalty_multiplier REAL NOT NULL DEFAULT 0.02,
            hard_penalty REAL NOT NULL DEFAULT 0.8,
            hard_penalty_linear REAL NOT NULL DEFAULT 0.28,
            hard_penalty_quadratic REAL NOT NULL DEFAULT 0.02,
            graduation_interval INTEGER NOT NULL DEFAULT 21,
            max_interval INTEGER NOT NULL DEFAULT 365,
            min_interval INTEGER NOT NULL DEFAULT 1,
            lapse_multiplier REAL NOT NULL DEFAULT 0.0,
            lapse_min_interval INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    
    # User preferences table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    
    # Vocabulary history table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS vocabulary_history (
            word TEXT NOT NULL,
            reading TEXT,
            meaning TEXT,
            jlpt_level TEXT,
            date_learned TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            PRIMARY KEY (word, date_learned)
        )
        """
    )
    
    # Add furigana column if it doesn't exist (migration)
    try:
        cur.execute("ALTER TABLE flashcards ADD COLUMN furigana TEXT")
    except Exception:
        # Column already exists, ignore
        pass
    # Add grammar column if it doesn't exist (migration)
    try:
        cur.execute("ALTER TABLE flashcards ADD COLUMN grammar TEXT")
    except Exception:
        # Column already exists, ignore
        pass
    
    # Initialize SRS stats if not exists
    cur.execute("INSERT OR IGNORE INTO srs_stats (id, total_reviews, correct_answers, last_updated) VALUES (1, 0, 0, ?)", (int(time.time() * 1000),))
    
    # Initialize default SRS settings if not exists
    current_time = int(time.time() * 1000)
    cur.execute("""
        INSERT OR IGNORE INTO srs_settings (
            id, name, min_ease_factor, max_ease_factor, initial_ease_factor,
            initial_interval, second_interval, max_difficulty, correct_threshold,
            easy_bonus, easy_penalty, easy_penalty_multiplier,
            hard_penalty, hard_penalty_linear, hard_penalty_quadratic,
            graduation_interval, max_interval, min_interval,
            lapse_multiplier, lapse_min_interval, created_at, updated_at
        ) VALUES (
            'default', 'SuperMemo 2 (Default)', 1.3, 2.5, 2.5,
            1, 6, 5, 3,
            0.1, 0.08, 0.02,
            0.8, 0.28, 0.02,
            21, 365, 1,
            0.0, 1, ?, ?
        )
    """, (current_time, current_time))
    
    conn.commit()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    return d


def insert_flashcard(card: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO flashcards (
            id, front, back, reading, image_path, notes, grammar, tags, difficulty, timestamp, furigana
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            card.get("id"),
            card.get("front"),
            card.get("back"),
            card.get("reading"),
            card.get("image_path"),
            card.get("notes"),
            card.get("grammar"),
            card.get("tags"),
            card.get("difficulty"),
            card.get("timestamp"),
            card.get("furigana"),
        ),
    )
    conn.commit()


def get_flashcards(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    sql = "SELECT * FROM flashcards ORDER BY timestamp DESC"
    if limit:
        sql += " LIMIT ?"
        cur.execute(sql, (limit,))
    else:
        cur.execute(sql)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def get_flashcard(card_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,))
    row = cur.fetchone()
    return row_to_dict(row) if row else None


def delete_flashcard(card_id: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM flashcards WHERE id = ?", (card_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    return deleted


# Series operations
def insert_series(series: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO series (
            id, title, author, description, cover_image, total_chapters, genre, status, added_date, last_read_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            series.get("id"),
            series.get("title"),
            series.get("author"),
            series.get("description"),
            series.get("cover_image"),
            series.get("total_chapters"),
            series.get("genre"),
            series.get("status", "ongoing"),
            series.get("added_date"),
            series.get("last_read_date"),
        ),
    )
    conn.commit()


def get_series(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    sql = "SELECT * FROM series ORDER BY added_date DESC"
    if limit:
        sql += " LIMIT ?"
        cur.execute(sql, (limit,))
    else:
        cur.execute(sql)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def get_series_by_id(series_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM series WHERE id = ?", (series_id,))
    row = cur.fetchone()
    return row_to_dict(row) if row else None


def update_series(series_id: str, updates: Dict[str, Any]) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    
    # Build dynamic update query
    set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
    values = list(updates.values()) + [series_id]
    
    cur.execute(f"UPDATE series SET {set_clause} WHERE id = ?", values)
    updated = cur.rowcount > 0
    conn.commit()
    return updated


def delete_series(series_id: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM series WHERE id = ?", (series_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    return deleted


# Chapter operations
def insert_chapter(chapter: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO chapters (
            id, series_id, chapter_number, title, file_path, page_count, added_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            chapter.get("id"),
            chapter.get("series_id"),
            chapter.get("chapter_number"),
            chapter.get("title"),
            chapter.get("file_path"),
            chapter.get("page_count"),
            chapter.get("added_date"),
        ),
    )
    conn.commit()


def get_chapters(series_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    if series_id:
        cur.execute("SELECT * FROM chapters WHERE series_id = ? ORDER BY chapter_number", (series_id,))
    else:
        cur.execute("SELECT * FROM chapters ORDER BY added_date DESC")
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def get_chapter_by_id(chapter_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,))
    row = cur.fetchone()
    return row_to_dict(row) if row else None


def update_chapter(chapter_id: str, updates: Dict[str, Any]) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    
    set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
    values = list(updates.values()) + [chapter_id]
    
    cur.execute(f"UPDATE chapters SET {set_clause} WHERE id = ?", values)
    updated = cur.rowcount > 0
    conn.commit()
    return updated


def delete_chapter(chapter_id: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    return deleted


# Reading progress operations
def upsert_reading_progress(progress: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO reading_progress (
            series_id, chapter_id, current_page, total_pages, percentage, last_read_date, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            progress.get("series_id"),
            progress.get("chapter_id"),
            progress.get("current_page"),
            progress.get("total_pages"),
            progress.get("percentage"),
            progress.get("last_read_date"),
            1 if progress.get("is_completed") else 0,
        ),
    )
    conn.commit()


def get_reading_progress(series_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    if series_id:
        cur.execute("SELECT * FROM reading_progress WHERE series_id = ?", (series_id,))
    else:
        cur.execute("SELECT * FROM reading_progress")
    rows = cur.fetchall()
    
    # Convert is_completed from int to bool
    result = []
    for row in rows:
        data = row_to_dict(row)
        data["is_completed"] = bool(data.get("is_completed", 0))
        result.append(data)
    return result


def get_chapter_progress(chapter_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM reading_progress WHERE chapter_id = ?", (chapter_id,))
    row = cur.fetchone()
    if row:
        data = row_to_dict(row)
        data["is_completed"] = bool(data.get("is_completed", 0))
        return data
    return None


# Bookmark operations
def insert_bookmark(bookmark: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO bookmarks (
            id, series_id, chapter_id, page_number, title, note, timestamp, screenshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            bookmark.get("id"),
            bookmark.get("series_id"),
            bookmark.get("chapter_id"),
            bookmark.get("page_number"),
            bookmark.get("title"),
            bookmark.get("note"),
            bookmark.get("timestamp"),
            bookmark.get("screenshot"),
        ),
    )
    conn.commit()


def get_bookmarks(series_id: Optional[str] = None, chapter_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    
    query = "SELECT * FROM bookmarks"
    params = []
    
    if series_id and chapter_id:
        query += " WHERE series_id = ? AND chapter_id = ?"
        params = [series_id, chapter_id]
    elif series_id:
        query += " WHERE series_id = ?"
        params = [series_id]
    elif chapter_id:
        query += " WHERE chapter_id = ?"
        params = [chapter_id]
    
    query += " ORDER BY timestamp DESC"
    cur.execute(query, params)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def delete_bookmark(bookmark_id: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    return deleted


# Reading session operations
def insert_reading_session(session: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO reading_sessions (
            id, series_id, chapter_id, start_time, end_time, pages_read, words_learned, 
            flashcards_created, characters_read, words_looked_up, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session.get("id"),
            session.get("series_id"),
            session.get("chapter_id"),
            session.get("start_time"),
            session.get("end_time"),
            session.get("pages_read", 0),
            session.get("words_learned", 0),
            session.get("flashcards_created", 0),
            session.get("characters_read", 0),
            session.get("words_looked_up", 0),
            session.get("date", time.strftime("%Y-%m-%d")),
        ),
    )
    conn.commit()


def get_reading_sessions(series_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    if series_id:
        cur.execute("SELECT * FROM reading_sessions WHERE series_id = ? ORDER BY start_time DESC", (series_id,))
    else:
        cur.execute("SELECT * FROM reading_sessions ORDER BY start_time DESC")
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def update_reading_session(session_id: str, updates: Dict[str, Any]) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    
    set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
    values = list(updates.values()) + [session_id]
    
    cur.execute(f"UPDATE reading_sessions SET {set_clause} WHERE id = ?", values)
    updated = cur.rowcount > 0
    conn.commit()
    return updated


# SRS operations
def upsert_srs_review(review: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO srs_reviews (
            card_id, interval_days, ease_factor, repetition, next_review, last_review, difficulty, streak
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            review.get("card_id"),
            review.get("interval_days"),
            review.get("ease_factor"),
            review.get("repetition"),
            review.get("next_review"),
            review.get("last_review"),
            review.get("difficulty"),
            review.get("streak", 0),
        ),
    )
    conn.commit()


def get_srs_review(card_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_reviews WHERE card_id = ?", (card_id,))
    row = cur.fetchone()
    return row_to_dict(row) if row else None

def delete_srs_review(card_id: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM srs_reviews WHERE card_id = ?", (card_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    return deleted


def get_all_srs_reviews(limit: Optional[int] = None, offset: Optional[int] = None, changed_since: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return SRS reviews with optional pagination and incremental filter.
    changed_since compares against last_review or next_review (whichever is newer).
    """
    conn = get_conn()
    cur = conn.cursor()
    clauses = []
    params: List[Any] = []
    if changed_since is not None:
        clauses.append("(last_review >= ? OR next_review >= ?)")
        params.extend([changed_since, changed_since])
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    order_sql = "ORDER BY next_review ASC"
    limit_sql = ""
    if limit is not None:
        limit_sql += " LIMIT ?"
        params.append(limit)
        if offset is not None:
            limit_sql += " OFFSET ?"
            params.append(offset)
    sql = f"SELECT * FROM srs_reviews {where_sql} {order_sql}{limit_sql}"
    cur.execute(sql, params)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def get_cards_due_for_review(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    current_time = int(time.time() * 1000)
    cur.execute(
        "SELECT * FROM srs_reviews WHERE next_review <= ? ORDER BY next_review LIMIT ?",
        (current_time, limit)
    )
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


def update_srs_stats(total_reviews_delta: int = 0, correct_answers_delta: int = 0) -> None:
    conn = get_conn()
    cur = conn.cursor()
    current_time = int(time.time() * 1000)
    cur.execute(
        """
        UPDATE srs_stats SET 
            total_reviews = total_reviews + ?,
            correct_answers = correct_answers + ?,
            last_updated = ?
        WHERE id = 1
        """,
        (total_reviews_delta, correct_answers_delta, current_time)
    )
    conn.commit()


def get_srs_stats() -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_stats WHERE id = 1")
    row = cur.fetchone()
    return row_to_dict(row) if row else {"total_reviews": 0, "correct_answers": 0, "last_updated": int(time.time() * 1000)}


def get_srs_streak() -> Dict[str, Any]:
    """Compute consecutive day streak with at least one correct review.
    Assumes correct answers are those where difficulty <=3 (as per mapping rules).
    """
    conn = get_conn()
    cur = conn.cursor()
    # Build a set of days (YYYY-MM-DD) with at least one correct review
    cur.execute("SELECT last_review, difficulty FROM srs_reviews")
    rows = cur.fetchall()
    days_with_review = set()
    for r in rows:
        try:
            diff = r["difficulty"]
            if diff <= 3:  # correct threshold
                day = time.strftime('%Y-%m-%d', time.gmtime(int(r["last_review"]) / 1000))
                days_with_review.add(day)
        except Exception:
            continue
    if not days_with_review:
        return {"streak": 0, "today_has_review": False}
    # Walk backwards from today
    streak = 0
    now = time.time()
    for i in range(0, 365):  # cap at 1 year for safety
        day_ts = now - i * 86400
        day_str = time.strftime('%Y-%m-%d', time.gmtime(day_ts))
        if day_str in days_with_review:
            streak += 1
        else:
            break
    today_str = time.strftime('%Y-%m-%d', time.gmtime(now))
    return {"streak": streak, "today_has_review": today_str in days_with_review}


# User preferences operations
def set_user_preference(key: str, value: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    current_time = int(time.time() * 1000)
    cur.execute(
        "INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, current_time)
    )
    conn.commit()


def get_user_preference(key: str) -> Optional[str]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT value FROM user_preferences WHERE key = ?", (key,))
    row = cur.fetchone()
    return row[0] if row else None


def get_all_user_preferences() -> Dict[str, str]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM user_preferences")
    rows = cur.fetchall()
    return {row[0]: row[1] for row in rows}


# Vocabulary history operations
def insert_vocabulary_entry(entry: Dict[str, Any]) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO vocabulary_history (
            word, reading, meaning, jlpt_level, date_learned, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            entry.get("word"),
            entry.get("reading"),
            entry.get("meaning"),
            entry.get("jlpt_level"),
            entry.get("date_learned"),
            entry.get("timestamp"),
        ),
    )
    conn.commit()


def get_vocabulary_history(date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    
    query = "SELECT * FROM vocabulary_history"
    params = []
    
    if date_from and date_to:
        query += " WHERE date_learned BETWEEN ? AND ?"
        params = [date_from, date_to]
    elif date_from:
        query += " WHERE date_learned >= ?"
        params = [date_from]
    elif date_to:
        query += " WHERE date_learned <= ?"
        params = [date_to]
    
    query += " ORDER BY timestamp DESC"
    cur.execute(query, params)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


# SRS settings operations
def get_srs_settings() -> Dict[str, Any]:
    """Get current SRS algorithm settings"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_settings WHERE id = 'default'")
    row = cur.fetchone()
    if row:
        return row_to_dict(row)
    else:
        # Return default settings if not found
        current_time = int(time.time() * 1000)
        return {
            'id': 'default',
            'name': 'SuperMemo 2 (Default)',
            'min_ease_factor': 1.3,
            'max_ease_factor': 2.5,
            'initial_ease_factor': 2.5,
            'initial_interval': 1,
            'second_interval': 6,
            'max_difficulty': 5,
            'correct_threshold': 3,
            'easy_bonus': 0.1,
            'easy_penalty': 0.08,
            'easy_penalty_multiplier': 0.02,
            'hard_penalty': 0.8,
            'hard_penalty_linear': 0.28,
            'hard_penalty_quadratic': 0.02,
            'graduation_interval': 21,
            'max_interval': 365,
            'min_interval': 1,
            'lapse_multiplier': 0.0,
            'lapse_min_interval': 1,
            'created_at': current_time,
            'updated_at': current_time
        }


def update_srs_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Update SRS algorithm settings"""
    conn = get_conn()
    cur = conn.cursor()
    current_time = int(time.time() * 1000)
    
    # Get current settings first
    current = get_srs_settings()
    
    # Update with new values
    for key, value in settings.items():
        if key in current and key not in ['id', 'created_at']:
            current[key] = value
    
    current['updated_at'] = current_time
    
    # Save to database
    cur.execute("""
        INSERT OR REPLACE INTO srs_settings (
            id, name, min_ease_factor, max_ease_factor, initial_ease_factor,
            initial_interval, second_interval, max_difficulty, correct_threshold,
            easy_bonus, easy_penalty, easy_penalty_multiplier,
            hard_penalty, hard_penalty_linear, hard_penalty_quadratic,
            graduation_interval, max_interval, min_interval,
            lapse_multiplier, lapse_min_interval, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        current['id'], current['name'], current['min_ease_factor'], current['max_ease_factor'],
        current['initial_ease_factor'], current['initial_interval'], current['second_interval'],
        current['max_difficulty'], current['correct_threshold'], current['easy_bonus'],
        current['easy_penalty'], current['easy_penalty_multiplier'], current['hard_penalty'],
        current['hard_penalty_linear'], current['hard_penalty_quadratic'], current['graduation_interval'],
        current['max_interval'], current['min_interval'], current['lapse_multiplier'],
        current['lapse_min_interval'], current['created_at'], current['updated_at']
    ))
    
    conn.commit()
    return current


def reset_srs_settings_to_defaults() -> Dict[str, Any]:
    """Reset SRS settings to default values"""
    conn = get_conn()
    cur = conn.cursor()
    current_time = int(time.time() * 1000)
    
    # Get created_at from existing record if it exists
    cur.execute("SELECT created_at FROM srs_settings WHERE id = 'default'")
    row = cur.fetchone()
    created_at = row[0] if row else current_time
    
    # Reset to defaults
    default_settings = {
        'id': 'default',
        'name': 'SuperMemo 2 (Default)',
        'min_ease_factor': 1.3,
        'max_ease_factor': 2.5,
        'initial_ease_factor': 2.5,
        'initial_interval': 1,
        'second_interval': 6,
        'max_difficulty': 5,
        'correct_threshold': 3,
        'easy_bonus': 0.1,
        'easy_penalty': 0.08,
        'easy_penalty_multiplier': 0.02,
        'hard_penalty': 0.8,
        'hard_penalty_linear': 0.28,
        'hard_penalty_quadratic': 0.02,
        'graduation_interval': 21,
        'max_interval': 365,
        'min_interval': 1,
        'lapse_multiplier': 0.0,
        'lapse_min_interval': 1,
        'created_at': created_at,
        'updated_at': current_time
    }
    
    cur.execute("""
        INSERT OR REPLACE INTO srs_settings (
            id, name, min_ease_factor, max_ease_factor, initial_ease_factor,
            initial_interval, second_interval, max_difficulty, correct_threshold,
            easy_bonus, easy_penalty, easy_penalty_multiplier,
            hard_penalty, hard_penalty_linear, hard_penalty_quadratic,
            graduation_interval, max_interval, min_interval,
            lapse_multiplier, lapse_min_interval, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        default_settings['id'], default_settings['name'], default_settings['min_ease_factor'],
        default_settings['max_ease_factor'], default_settings['initial_ease_factor'],
        default_settings['initial_interval'], default_settings['second_interval'],
        default_settings['max_difficulty'], default_settings['correct_threshold'],
        default_settings['easy_bonus'], default_settings['easy_penalty'],
        default_settings['easy_penalty_multiplier'], default_settings['hard_penalty'],
        default_settings['hard_penalty_linear'], default_settings['hard_penalty_quadratic'],
        default_settings['graduation_interval'], default_settings['max_interval'],
        default_settings['min_interval'], default_settings['lapse_multiplier'],
        default_settings['lapse_min_interval'], default_settings['created_at'],
        default_settings['updated_at']
    ))
    
    conn.commit()
    return default_settings
