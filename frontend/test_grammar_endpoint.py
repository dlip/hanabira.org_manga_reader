#!/usr/bin/env python3
"""
Test script for the grammar explanation endpoint
"""

import requests
import json
import sys

def test_grammar_explanation():
    """Test the grammar explanation endpoint"""
    
    # Test sentence
    test_text = "私は昨日学校へ行きました。"
    
    url = "http://localhost:5000/grammar/explain"
    payload = {
        "text": test_text
    }
    
    try:
        print(f"Testing grammar explanation for: {test_text}")
        print("Sending request to:", url)
        print("Payload:", json.dumps(payload, indent=2, ensure_ascii=False))
        print("-" * 50)
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print("Response:")
        
        if response.status_code == 200:
            result = response.json()
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            if result.get('success'):
                print("\n" + "="*50)
                print("GRAMMAR EXPLANATION:")
                print("="*50)
                print(result.get('explanation', 'No explanation provided'))
            else:
                print(f"Error: {result.get('error', 'Unknown error')}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the backend server.")
        print("Make sure the Flask backend is running on localhost:5000")
        return False
    except requests.exceptions.Timeout:
        print("Error: Request timed out")
        return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False
        
    return True

if __name__ == "__main__":
    success = test_grammar_explanation()
    sys.exit(0 if success else 1)