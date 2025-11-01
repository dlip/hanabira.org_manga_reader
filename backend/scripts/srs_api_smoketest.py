#!/usr/bin/env python3
"""SRS API Smoke Test

This script performs a minimal end-to-end verification of the SRS backend:
1. Ensures at least one flashcard exists (creates a temporary one if needed)
2. Posts an initial /srs/reviews upsert with future next_review (should not appear in /srs/due)
3. Updates the same review with a past next_review (should appear in /srs/due)
4. Updates SRS stats
5. Fetches /srs/reviews, /srs/due, /srs/stats and prints a concise PASS/FAIL summary

Exit code 0 indicates success, non‑zero indicates failure.
"""
from __future__ import annotations
import argparse
import time
import uuid
import sys
import requests
from typing import Any, Dict


def log(msg: str) -> None:
    print(f"[srs-smoke] {msg}")


def require(cond: bool, msg: str) -> None:
    if not cond:
        log(f"FAIL: {msg}")
        sys.exit(1)


def ensure_flashcard(base: str) -> str:
    resp = requests.get(f"{base}/flashcards", timeout=10)
    data = resp.json()
    if data.get("flashcards"):
        return data["flashcards"][0]["id"]
    # create one
    card_id = f"smoke_{uuid.uuid4().hex[:8]}"
    payload = {
        "id": card_id,
        "front": "テスト",
        "back": "test",
        "reading": "てすと",
        "timestamp": int(time.time() * 1000),
        "notes": "smoke test",
        "difficulty": "medium",
        "tags": "smoke"
    }
    c_resp = requests.post(f"{base}/flashcards", json=payload, timeout=10)
    require(c_resp.status_code in (200, 201), f"Create flashcard failed: {c_resp.text}")
    return card_id


def upsert_review(base: str, card_id: str, *, interval_days: int, ease: float, repetition: int, next_review: int, last_review: int, difficulty: int, streak: int) -> None:
    payload = {
        "card_id": card_id,
        "interval_days": interval_days,
        "ease_factor": ease,
        "repetition": repetition,
        "next_review": next_review,
        "last_review": last_review,
        "difficulty": difficulty,
        "streak": streak,
    }
    r = requests.post(f"{base}/srs/reviews", json=payload, timeout=10)
    require(r.status_code == 200 and r.json().get("success"), f"Upsert review failed: {r.text}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5000", help="Base URL of backend")
    ap.add_argument("--card-id", help="Existing flashcard id to reuse (optional)")
    args = ap.parse_args()

    base = args.base.rstrip('/')
    start = time.time()

    log(f"Base URL: {base}")

    card_id = args.card_id or ensure_flashcard(base)
    log(f"Using card: {card_id}")

    now = int(time.time() * 1000)
    # Step 1: future next_review (should NOT be due)
    upsert_review(base, card_id, interval_days=1, ease=2.5, repetition=1, next_review=now + 3600_000, last_review=now, difficulty=3, streak=1)
    due1 = requests.get(f"{base}/srs/due", timeout=10).json().get("cards", [])
    require(not any(r["card_id"] == card_id for r in due1), "Card unexpectedly due after future next_review")
    log("Future next_review correctly excluded from /srs/due")

    # Step 2: past next_review (should be due)
    now2 = int(time.time() * 1000)
    upsert_review(base, card_id, interval_days=2, ease=2.4, repetition=2, next_review=now2 - 1000, last_review=now2, difficulty=2, streak=2)
    due2 = requests.get(f"{base}/srs/due", timeout=10).json().get("cards", [])
    require(any(r["card_id"] == card_id for r in due2), "Card missing from /srs/due after past next_review")
    log("Past next_review correctly included in /srs/due")

    # Step 3: stats update
    stats_resp = requests.post(f"{base}/srs/stats", json={"total_reviews_delta": 1, "correct_answers_delta": 1}, timeout=10)
    require(stats_resp.status_code == 200 and stats_resp.json().get("success"), f"Stats update failed: {stats_resp.text}")

    stats = requests.get(f"{base}/srs/stats", timeout=10).json().get("stats")
    require(stats is not None, "Stats fetch returned none")

    # Step 4: final review fetch
    reviews = requests.get(f"{base}/srs/reviews", timeout=10).json().get("reviews", [])
    require(any(r["card_id"] == card_id for r in reviews), "Inserted review not found in /srs/reviews")

    elapsed = time.time() - start
    log("All checks passed ✅")
    log(f"Duration: {elapsed:.2f}s")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        raise
    except Exception as e:
        log(f"UNCAUGHT ERROR: {e}")
        sys.exit(2)
