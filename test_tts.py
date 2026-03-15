#!/usr/bin/env python3
"""Test Qwen3 TTS model with DashScope API"""

import requests
import json
import sys

API_KEY = "sk-d79fd623541c4a309d6cb51245ac31ef"
MODEL = "qwen3-tts-vd-2026-01-26"
URL = "https://dashscope.aliyuncs.com/api/v1/services/tts/text-to-speech"

test_text = "Tell me about a time you had to work under pressure in a high-stakes situation."

print("=" * 80)
print(f"Testing Qwen3 TTS Model: {MODEL}")
print(f"API Key: {API_KEY[:20]}...")
print(f"URL: {URL}")
print("=" * 80)

headers = {
    'Content-Type': 'application/json',
    'X-DashScope-Async': 'false',
    'Authorization': f'Bearer {API_KEY}',
}

payload = {
    "model": MODEL,
    "input": {
        "text": test_text,
    },
    "parameters": {
        "voice": "longxiao",
        "rate": 100,
        "pitch": 100,
        "format": "wav",
    },
}

print("\nRequest Headers:")
print(json.dumps({k: v if k != 'Authorization' else v[:30] + '...' for k, v in headers.items()}, indent=2))

print("\nRequest Body:")
print(json.dumps(payload, indent=2, ensure_ascii=False))

print("\nSending request...")
print("-" * 80)

try:
    response = requests.post(URL, headers=headers, json=payload, timeout=30)

    print(f"Response Status: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")

    if response.status_code == 200:
        print("\n✅ SUCCESS! TTS API is working!")
        print(f"Response size: {len(response.content)} bytes")
        # Try to parse as JSON
        try:
            data = response.json()
            print("Response JSON:", json.dumps(data, indent=2, ensure_ascii=False)[:500])
        except:
            print("(Binary audio response)")
    else:
        print(f"\n❌ ERROR! Status {response.status_code}")
        try:
            error_data = response.json()
            print("Error Response:")
            print(json.dumps(error_data, indent=2, ensure_ascii=False))
        except:
            print("Response Text:", response.text[:500])

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
