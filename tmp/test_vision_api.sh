#!/bin/bash
set -euo pipefail

API_KEY="${ANTHROPIC_AUTH_TOKEN:-}"
BASE_URL="${ANTHROPIC_BASE_URL:-https://api.kimi.com/coding}"
MODEL="${ANTHROPIC_MODEL:-kimi-k2.6}"

if [[ -z "$API_KEY" ]]; then
  echo "Error: ANTHROPIC_AUTH_TOKEN is not set." >&2
  exit 1
fi

# Generate a test PNG and get its base64 data
IMAGE_B64=$(python3 - <<'PY'
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (400, 300), color=(245, 247, 250))
draw = ImageDraw.Draw(img)
draw.rectangle([30, 30, 170, 130], fill=(100, 149, 237), outline=(25, 25, 112), width=3)
draw.ellipse([220, 40, 360, 140], fill=(144, 238, 144), outline=(34, 139, 34), width=3)
draw.polygon([(200, 200), (100, 280), (300, 280)], fill=(255, 182, 193), outline=(220, 20, 60), width=3)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
except Exception:
    font = ImageFont.load_default()
draw.text((40, 150), "Vision Test", fill=(0, 0, 0), font=font)
draw.text((40, 180), "Blue rect / Green circle / Pink triangle", fill=(50, 50, 50), font=font)

buf = BytesIO()
img.save(buf, format="PNG")
print(base64.b64encode(buf.getvalue()).decode("utf-8"), end="")
PY
)

URL="${BASE_URL%/}/v1/messages"

echo "Endpoint: $URL"
echo "Model: $MODEL"
echo "API key prefix: ${API_KEY:0:8}..."
echo "Image bytes (base64): ${#IMAGE_B64}"
echo "Sending vision request..."

# Build JSON payload
PAYLOAD=$(python3 - "$IMAGE_B64" "$MODEL" <<'PY'
import json, sys
image_b64, model = sys.argv[1], sys.argv[2]
payload = {
    "model": model,
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
print(json.dumps(payload, ensure_ascii=False))
PY
)

# Send request with curl
RESP_BODY=$(mktemp)
HTTP_CODE=$(curl -sS -w "%{http_code}" -o "$RESP_BODY" -X POST "$URL" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$PAYLOAD" \
  -m 120)

echo "HTTP status: $HTTP_CODE"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo ""
  echo "--- Raw response ---"
  cat "$RESP_BODY"
  echo ""
  echo ""
  echo "--- Extracted text ---"
  python3 - "$RESP_BODY" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
print(text if text else json.dumps(data, ensure_ascii=False, indent=2))
PY
  rm -f "$RESP_BODY"
  echo ""
  echo "Vision model test completed successfully."
  exit 0
else
  echo ""
  echo "--- Error response ---"
  cat "$RESP_BODY"
  rm -f "$RESP_BODY"
  echo ""
  exit 1
fi
