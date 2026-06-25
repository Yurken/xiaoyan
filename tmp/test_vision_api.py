#!/usr/bin/env python3
"""Test Xiaoyan vision model via Anthropic-compatible Kimi Coding endpoint."""
import base64
import json
import os
from io import BytesIO

import requests
from PIL import Image, ImageDraw, ImageFont

API_KEY = os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.kimi.com/coding")
MODEL = os.environ.get("ANTHROPIC_MODEL", "kimi-k2.6")


def make_test_image() -> str:
    """Generate a simple test PNG and return its base64 data."""
    img = Image.new("RGB", (400, 300), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)
    # Draw shapes
    draw.rectangle([30, 30, 170, 130], fill=(100, 149, 237), outline=(25, 25, 112), width=3)
    draw.ellipse([220, 40, 360, 140], fill=(144, 238, 144), outline=(34, 139, 34), width=3)
    draw.polygon([(200, 200), (100, 280), (300, 280)], fill=(255, 182, 193), outline=(220, 20, 60), width=3)
    # Draw text
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
    except Exception:
        font = ImageFont.load_default()
    draw.text((40, 150), "Vision Test", fill=(0, 0, 0), font=font)
    draw.text((40, 180), "Blue rect / Green circle / Pink triangle", fill=(50, 50, 50), font=font)

    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    if not API_KEY:
        print("Error: ANTHROPIC_AUTH_TOKEN is not set.")
        return 1

    image_b64 = make_test_image()
    url = BASE_URL.rstrip("/") + "/v1/messages"
    headers = {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "temperature": 0.2,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": "请描述这张图片里有什么。"},
                ],
            }
        ],
    }

    print(f"Endpoint: {url}")
    print(f"Model: {MODEL}")
    print(f"API key prefix: {API_KEY[:8]}...")
    print(f"Image bytes (base64): {len(image_b64)} chars")
    print("Sending request...")

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
        print(f"HTTP status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            text = ""
            for block in data.get("content", []):
                if block.get("type") == "text":
                    text += block.get("text", "")
            print("\n--- Response ---")
            print(text or json.dumps(data, ensure_ascii=False, indent=2))
            print("\nVision model test completed successfully.")
            return 0
        else:
            print("\n--- Error Response ---")
            try:
                print(json.dumps(resp.json(), ensure_ascii=False, indent=2))
            except Exception:
                print(resp.text[:2000])
            return 1
    except Exception as e:
        print(f"Request failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
