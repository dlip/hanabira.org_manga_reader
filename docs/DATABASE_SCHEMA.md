# Mokuro Reader Enhanced - Database Schema

This document describes the SQLite database structure used by the Mokuro Reader Enhanced application.

## Database File Location
- Default path: `backend/data/flashcards.db`
- Environment variable: `FLASHCARDS_DB_PATH`

## Tables Overview

### 1. flashcards
Stores user-created flashcards with Japanese vocabulary and phrases.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique identifier for the flashcard |
| front | TEXT NOT NULL | Front side of the card (typically Japanese text) |
| back | TEXT NOT NULL | Back side of the card (typically English meaning) |
| reading | TEXT | Phonetic reading (hiragana/katakana) |
| image_path | TEXT | Path to associated image file |
| notes | TEXT | User notes about the word/phrase |
| grammar | TEXT | Grammar information |
| tags | TEXT | Comma-separated tags for organization |
| difficulty | TEXT | Difficulty level (easy/medium/hard) |
| timestamp | INTEGER NOT NULL | Creation timestamp |
| furigana | TEXT | Furigana data structure (JSON) |

### 2. series
Stores manga series information.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique series identifier |
| title | TEXT NOT NULL | Series title |
| author | TEXT | Author name |
| description | TEXT | Series description |
| cover_image | TEXT | Path to cover image |
| total_chapters | INTEGER | Number of chapters |
| genre | TEXT | Genre classification |
| status | TEXT DEFAULT 'ongoing' | Reading status (ongoing/completed/hiatus/dropped) |
| added_date | INTEGER NOT NULL | Date added to library |
| last_read_date | INTEGER | Last reading timestamp |

### 3. chapters
Stores individual chapter information for each series.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique chapter identifier |
| series_id | TEXT NOT NULL | Foreign key to series table |
| chapter_number | INTEGER NOT NULL | Chapter number within series |
| title | TEXT | Chapter title |
| file_path | TEXT NOT NULL | Path to mokuro HTML file |
| page_count | INTEGER | Number of pages in chapter |
| added_date | INTEGER NOT NULL | Date added timestamp |

**Foreign Keys:**
- `series_id` → `series(id)` ON DELETE CASCADE

### 4. reading_progress
Tracks reading progress for each chapter.

| Column | Type | Description |
|--------|------|-------------|
| series_id | TEXT NOT NULL | Foreign key to series table |
| chapter_id | TEXT NOT NULL | Foreign key to chapters table |
| current_page | INTEGER NOT NULL | Current page number |
| total_pages | INTEGER NOT NULL | Total pages in chapter |
| percentage | REAL NOT NULL | Progress percentage (0-100) |
| last_read_date | INTEGER NOT NULL | Last read timestamp |
| is_completed | INTEGER DEFAULT 0 | Completion flag (0/1) |

**Primary Key:** `(series_id, chapter_id)`
**Foreign Keys:**
- `series_id` → `series(id)` ON DELETE CASCADE
- `chapter_id` → `chapters(id)` ON DELETE CASCADE

### 5. bookmarks
Stores user bookmarks for specific pages.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique bookmark identifier |
| series_id | TEXT NOT NULL | Foreign key to series table |
| chapter_id | TEXT NOT NULL | Foreign key to chapters table |
| page_number | INTEGER NOT NULL | Bookmarked page number |
| title | TEXT | Bookmark title |
| note | TEXT | User notes for the bookmark |
| timestamp | INTEGER NOT NULL | Creation timestamp |
| screenshot | TEXT | Path to screenshot (if any) |

**Foreign Keys:**
- `series_id` → `series(id)` ON DELETE CASCADE
- `chapter_id` → `chapters(id)` ON DELETE CASCADE

### 6. reading_sessions
Tracks reading sessions and analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique session identifier |
| series_id | TEXT | Foreign key to series table |
| chapter_id | TEXT | Foreign key to chapters table |
| start_time | INTEGER NOT NULL | Session start timestamp |
| end_time | INTEGER | Session end timestamp |
| pages_read | INTEGER DEFAULT 0 | Pages read in session |
| words_learned | INTEGER DEFAULT 0 | New words learned |
| flashcards_created | INTEGER DEFAULT 0 | Flashcards created in session |
| characters_read | INTEGER DEFAULT 0 | Characters read count |
| words_looked_up | INTEGER DEFAULT 0 | Dictionary lookups count |
| date | TEXT NOT NULL | Session date (YYYY-MM-DD) |

**Foreign Keys:**
- `series_id` → `series(id)` ON DELETE SET NULL
- `chapter_id` → `chapters(id)` ON DELETE SET NULL

### 7. srs_reviews
Spaced Repetition System data for flashcards.

| Column | Type | Description |
|--------|------|-------------|
| card_id | TEXT PRIMARY KEY | Foreign key to flashcards table |
| interval_days | INTEGER NOT NULL | Current review interval in days |
| ease_factor | REAL NOT NULL | Current ease factor (SuperMemo algorithm) |
| repetition | INTEGER NOT NULL | Number of successful repetitions |
| next_review | INTEGER NOT NULL | Next review timestamp |
| last_review | INTEGER NOT NULL | Last review timestamp |
| difficulty | INTEGER NOT NULL | Last difficulty rating (1-5) |
| streak | INTEGER DEFAULT 0 | Current correct answer streak |

**Foreign Keys:**
- `card_id` → `flashcards(id)` ON DELETE CASCADE

### 8. srs_stats
Global SRS statistics.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Always 1 (singleton record) |
| total_reviews | INTEGER DEFAULT 0 | Total number of reviews completed |
| correct_answers | INTEGER DEFAULT 0 | Total correct answers |
| last_updated | INTEGER NOT NULL | Last update timestamp |

### 9. srs_settings
Configurable SRS algorithm parameters.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Settings profile identifier |
| name | TEXT NOT NULL | Profile name |
| min_ease_factor | REAL DEFAULT 1.3 | Minimum ease factor |
| max_ease_factor | REAL DEFAULT 2.5 | Maximum ease factor |
| initial_ease_factor | REAL DEFAULT 2.5 | Starting ease factor |
| initial_interval | INTEGER DEFAULT 1 | First review interval (days) |
| second_interval | INTEGER DEFAULT 6 | Second review interval (days) |
| max_difficulty | INTEGER DEFAULT 5 | Maximum difficulty rating |
| correct_threshold | INTEGER DEFAULT 3 | Threshold for "correct" answers |
| easy_bonus | REAL DEFAULT 0.1 | Ease bonus for easy answers |
| easy_penalty | REAL DEFAULT 0.08 | Ease penalty base |
| easy_penalty_multiplier | REAL DEFAULT 0.02 | Ease penalty multiplier |
| hard_penalty | REAL DEFAULT 0.8 | Ease penalty for hard answers |
| hard_penalty_linear | REAL DEFAULT 0.28 | Linear penalty factor |
| hard_penalty_quadratic | REAL DEFAULT 0.02 | Quadratic penalty factor |
| graduation_interval | INTEGER DEFAULT 21 | Days to consider card "graduated" |
| max_interval | INTEGER DEFAULT 365 | Maximum review interval |
| min_interval | INTEGER DEFAULT 1 | Minimum review interval |
| lapse_multiplier | REAL DEFAULT 0.0 | Multiplier for lapsed cards |
| lapse_min_interval | INTEGER DEFAULT 1 | Minimum interval for lapsed cards |
| created_at | INTEGER NOT NULL | Creation timestamp |
| updated_at | INTEGER NOT NULL | Last update timestamp |

### 10. user_preferences
User configuration settings.

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | Preference key |
| value | TEXT NOT NULL | Preference value (JSON string) |
| updated_at | INTEGER NOT NULL | Last update timestamp |

### 11. vocabulary_history
Historical record of vocabulary lookups.

| Column | Type | Description |
|--------|------|-------------|
| word | TEXT NOT NULL | Japanese word |
| reading | TEXT | Phonetic reading |
| meaning | TEXT | English meaning |
| jlpt_level | TEXT | JLPT level classification |
| date_learned | TEXT NOT NULL | Date learned (YYYY-MM-DD) |
| timestamp | INTEGER NOT NULL | Lookup timestamp |

**Primary Key:** `(word, date_learned)`

## Relationships

```
series (1) ----< chapters (M)
  |                 |
  |                 |
  v                 v
reading_progress    |
  ^                 |
  |                 |
  +--------+--------+
           |
           v
       bookmarks
           
flashcards (1) ----< srs_reviews (1)

reading_sessions >---- series (0..1)
reading_sessions >---- chapters (0..1)

vocabulary_history (independent)
srs_stats (singleton)
srs_settings (configurations)
user_preferences (key-value store)
```

## Database Initialization

The database is automatically created and initialized with:
- Default SRS settings profile ("SuperMemo 2 (Default)")
- Initial SRS stats record
- All table structures with proper foreign key constraints

## Data Directory Structure

```
backend/data/
├── flashcards.db          # Main SQLite database
└── images/                # Directory for flashcard images
    └── [image files]
```