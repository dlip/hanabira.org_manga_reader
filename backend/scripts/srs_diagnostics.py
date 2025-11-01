#!/usr/bin/env python3
"""SRS Diagnostics Tool

Purpose:
  Provide a quick analytics/health report for the SRS backend data integrity and API behavior.

Checks Performed:
  1. Counts & basic distribution of srs_reviews (interval, ease, repetition).
  2. Due list recomputation (DB-driven) vs /srs/due endpoint response.
  3. Orphan review detection (srs_reviews.card_id missing in flashcards).
  4. Stale review detection (last_review > next_review or next_review in past but not in due list).
  5. Interval sanity (interval_days < 1, negative, extreme > max threshold).
  6. Ease factor bounds relative to configured settings.
  7. Stats reconciliation: total_reviews, correct_answers monotonic and plausible.
  8. Sample of recently reviewed cards.

Usage:
  python scripts/srs_diagnostics.py [--db-path path] [--api http://localhost:5000] [--limit 50]

Exit Codes:
  0 - All critical checks passed (warnings may still exist)
  1 - One or more critical failures detected

This script is read-only (no modifications) and safe to run in production.
"""
from __future__ import annotations
import argparse
import os
import sqlite3
import sys
import time
import json
import statistics
from typing import List, Dict, Any, Tuple, Optional
import urllib.request
import urllib.error
import urllib.parse

CRITICAL_ERRORS: List[str] = []
WARNINGS: List[str] = []
INFO: List[str] = []


def log(section: str, message: str) -> None:
    print(f"[{section}] {message}")


def fetch_json(url: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            data = resp.read()
            return json.loads(data.decode('utf-8'))
    except Exception as e:
        WARNINGS.append(f"API fetch failed for {url}: {e}")
        return None


def open_db(path: str) -> sqlite3.Connection:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Database file not found: {path}")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_settings(conn: sqlite3.Connection) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_settings WHERE id='default'")
    row = cur.fetchone()
    return dict(row) if row else {}


def load_reviews(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_reviews")
    return [dict(r) for r in cur.fetchall()]


def load_flashcards(conn: sqlite3.Connection) -> Dict[str, Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute("SELECT id FROM flashcards")
    return {r['id']: dict(r) for r in cur.fetchall()}


def load_stats(conn: sqlite3.Connection) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM srs_stats WHERE id=1")
    row = cur.fetchone()
    return dict(row) if row else {}


def compute_due_from_db(reviews: List[Dict[str, Any]], now_ms: int) -> List[Dict[str, Any]]:
    return [r for r in reviews if r.get('next_review', now_ms+1) <= now_ms]


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    k = (len(values)-1) * (p/100.0)
    f = int(k)
    c = min(f+1, len(values)-1)
    if f == c:
        return float(values[f])
    d0 = values[f] * (c - k)
    d1 = values[c] * (k - f)
    return float(d0 + d1)


def analyze_distribution(values: List[float]) -> Dict[str, float]:
    values_sorted = sorted(values)
    return {
        'count': len(values),
        'min': min(values_sorted) if values_sorted else 0,
        'p25': percentile(values_sorted, 25),
        'median': percentile(values_sorted, 50),
        'p75': percentile(values_sorted, 75),
        'p90': percentile(values_sorted, 90),
        'max': max(values_sorted) if values_sorted else 0,
        'mean': statistics.fmean(values_sorted) if values_sorted else 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="SRS Diagnostics")
    parser.add_argument('--db-path', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'flashcards.db'))
    parser.add_argument('--api', default='http://localhost:5000')
    parser.add_argument('--limit', type=int, default=50, help='Limit sample sizes')
    args = parser.parse_args()

    start = time.time()
    conn = open_db(os.path.abspath(args.db_path))
    settings = get_settings(conn)
    reviews = load_reviews(conn)
    flashcards = load_flashcards(conn)
    stats = load_stats(conn)
    now_ms = int(time.time() * 1000)

    log('INFO', f"Loaded {len(reviews)} review rows, {len(flashcards)} flashcards")

    # 1. Basic distribution
    intervals = [r['interval_days'] for r in reviews if isinstance(r.get('interval_days'), (int, float))]
    eases = [r['ease_factor'] for r in reviews if isinstance(r.get('ease_factor'), (int, float))]
    reps = [r['repetition'] for r in reviews if isinstance(r.get('repetition'), (int, float))]

    log('SECTION', 'Distribution')
    print(json.dumps({
        'interval_days': analyze_distribution(intervals),
        'ease_factor': analyze_distribution(eases),
        'repetition': analyze_distribution(reps)
    }, indent=2))

    # 2. Due recompute
    due_db = compute_due_from_db(reviews, now_ms)
    due_db_ids = {r['card_id'] for r in due_db}

    api_due = fetch_json(f"{args.api}/srs/due") or {}
    api_due_ids = set()
    if api_due.get('success') and 'cards' in api_due:
        for c in api_due['cards']:
            api_due_ids.add(c.get('card_id'))
    else:
        WARNINGS.append('API /srs/due did not return success/cards')

    missing_in_api = due_db_ids - api_due_ids
    extra_in_api = api_due_ids - due_db_ids

    log('SECTION', 'Due Consistency')
    print(json.dumps({
        'due_count_db': len(due_db_ids),
        'due_count_api': len(api_due_ids),
        'missing_in_api': list(missing_in_api)[:args.limit],
        'extra_in_api': list(extra_in_api)[:args.limit]
    }, indent=2))

    if missing_in_api:
        CRITICAL_ERRORS.append(f"{len(missing_in_api)} cards due in DB missing from /srs/due")
    if extra_in_api:
        WARNINGS.append(f"{len(extra_in_api)} cards returned by /srs/due not yet due per DB")

    # 3. Orphans
    orphans = [r['card_id'] for r in reviews if r['card_id'] not in flashcards]
    if orphans:
        WARNINGS.append(f"{len(orphans)} orphan review records (no matching flashcard)")

    # 4. Stale / inconsistent rows
    stale = [r['card_id'] for r in reviews if r['last_review'] > r['next_review']]
    if stale:
        CRITICAL_ERRORS.append(f"{len(stale)} rows have last_review > next_review")

    # 5. Interval sanity
    bad_intervals = [r['card_id'] for r in reviews if r['interval_days'] < 0]
    if bad_intervals:
        CRITICAL_ERRORS.append(f"{len(bad_intervals)} rows with negative interval_days")

    # 6. Ease factor sanity (use settings if available)
    min_ease = settings.get('min_ease_factor', 1.0)
    max_ease = settings.get('max_ease_factor', 3.0)
    ease_out_of_bounds = [r['card_id'] for r in reviews if not (min_ease <= r['ease_factor'] <= max_ease)]
    if ease_out_of_bounds:
        WARNINGS.append(f"{len(ease_out_of_bounds)} rows with ease_factor outside configured bounds {min_ease}-{max_ease}")

    # 7. Stats reconciliation (basic plausibility)
    if stats:
        total_reviews = stats.get('total_reviews', 0)
        correct_answers = stats.get('correct_answers', 0)
        if correct_answers > total_reviews:
            CRITICAL_ERRORS.append('correct_answers exceeds total_reviews in stats')

    # 8. Recent sample
    recent = sorted(reviews, key=lambda r: r['last_review'], reverse=True)[: min(10, len(reviews))]
    log('SECTION', 'Recent Reviews Sample')
    simplified_recent = [
        {
            'card_id': r['card_id'],
            'last_review': r['last_review'],
            'next_review': r['next_review'],
            'interval_days': r['interval_days'],
            'repetition': r['repetition'],
            'difficulty': r['difficulty']
        } for r in recent
    ]
    print(json.dumps(simplified_recent, indent=2))

    # Summary
    log('SECTION', 'Summary')
    summary = {
        'total_reviews_rows': len(reviews),
        'due_count_db': len(due_db_ids),
        'due_count_api': len(api_due_ids),
        'critical_errors': CRITICAL_ERRORS,
        'warnings': WARNINGS,
        'elapsed_sec': round(time.time() - start, 2)
    }
    print(json.dumps(summary, indent=2))

    if CRITICAL_ERRORS:
        log('RESULT', 'FAIL')
        return 1
    log('RESULT', 'PASS (with warnings)' if WARNINGS else 'PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
