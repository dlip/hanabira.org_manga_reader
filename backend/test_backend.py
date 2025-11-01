#!/usr/bin/env python3
"""
Simple test script to verify the translation backend is working
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_openai_translation():
    """Test OpenAI translation"""
    print("\nTesting OpenAI translation...")
    try:
        data = {
            "text": "こんにちは",
            "provider": "openai"
        }
        response = requests.post(f"{BASE_URL}/translate", json=data)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return response.status_code == 200 and result.get("success", False)
    except Exception as e:
        print(f"OpenAI translation test failed: {e}")
        return False

def test_deepl_translation():
    """Test DeepL translation"""
    print("\nTesting DeepL translation...")
    try:
        data = {
            "text": "こんにちは",
            "provider": "deepl"
        }
        response = requests.post(f"{BASE_URL}/translate", json=data)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return response.status_code == 200 and result.get("success", False)
    except Exception as e:
        print(f"DeepL translation test failed: {e}")
        return False

def test_compare_translations():
    """Test comparison endpoint"""
    print("\nTesting translation comparison...")
    try:
        data = {"text": "今日は良い天気ですね"}
        response = requests.post(f"{BASE_URL}/translate/compare", json=data)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Translation comparison test failed: {e}")
        return False


def test_flashcards_crud():
    print("\nTesting flashcards CRUD...")
    try:
        # Create
        new_card = {
            "id": f"flashcard_test_{__import__('time').time()}",
            "front": "テスト",
            "back": "test",
            "timestamp": int(__import__('time').time() * 1000),
            "difficulty": "medium",
        }
        r = requests.post(f"{BASE_URL}/flashcards", json=new_card)
        print("Create status:", r.status_code, r.text)
        if r.status_code not in (200, 201):
            return False

        # List
        r = requests.get(f"{BASE_URL}/flashcards")
        print("List status:", r.status_code)
        data = r.json()
        assert data.get("success"), data
        assert any(fc.get("id") == new_card["id"] for fc in data.get("flashcards", []))

        # Get one
        r = requests.get(f"{BASE_URL}/flashcards/{new_card['id']}")
        print("Get status:", r.status_code)
        if r.status_code != 200:
            return False

        # Delete
        r = requests.delete(f"{BASE_URL}/flashcards/{new_card['id']}")
        print("Delete status:", r.status_code)
        return r.status_code == 200
    except Exception as e:
        print("Flashcards CRUD test failed:", e)
        return False

if __name__ == "__main__":
    print("=== Translation Backend Test Suite ===")
    
    tests = [
        ("Health Check", test_health),
        ("OpenAI Translation", test_openai_translation),
        ("DeepL Translation", test_deepl_translation),
        ("Translation Comparison", test_compare_translations),
        ("Flashcards CRUD", test_flashcards_crud),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        result = test_func()
        results.append((test_name, result))
        print(f"{'PASS' if result else 'FAIL'}")
    
    print(f"\n{'='*50}")
    print("SUMMARY:")
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  {test_name}: {status}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")