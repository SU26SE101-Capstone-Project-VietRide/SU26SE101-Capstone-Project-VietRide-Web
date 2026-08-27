#!/usr/bin/env bash
# Test nhanh 2 key Goong có dùng được không, không cần mở trình duyệt.
#
# Cách dùng:
#   ./scripts/test-goong-key.sh                        # tự đọc cả 2 key từ .env
#   ./scripts/test-goong-key.sh <API_KEY> <MAPTILES_KEY>
#
# Script chỉ GỌI ĐỌC các endpoint public, không sửa gì trên tài khoản Goong.

set -uo pipefail

API_KEY="${1:-}"
MAPTILES_KEY="${2:-}"
REST="${VITE_GOONG_REST_BASE_URL:-https://rsapi.goong.io}"

read_env() { grep "^$1=" .env 2>/dev/null | cut -d= -f2- | tr -d '\r'; }

[ -z "$API_KEY" ] && API_KEY=$(read_env VITE_GOONG_API_KEY)
[ -z "$MAPTILES_KEY" ] && MAPTILES_KEY=$(read_env VITE_GOONG_MAPTILES_KEY)

if [ -z "$API_KEY" ] && [ -z "$MAPTILES_KEY" ]; then
  echo "Không tìm thấy key. Điền VITE_GOONG_API_KEY + VITE_GOONG_MAPTILES_KEY vào .env,"
  echo "hoặc: ./scripts/test-goong-key.sh <API_KEY> <MAPTILES_KEY>"
  exit 1
fi

mask() { [ -z "$1" ] && echo "(trống)" || echo "${1:0:4}...${1: -4}"; }
echo "API key      : $(mask "$API_KEY")   → $REST"
echo "Maptiles key : $(mask "$MAPTILES_KEY") → tiles.goong.io"
echo

if [ -n "$MAPTILES_KEY" ]; then
  echo "== 1) Maptiles: style bản đồ =="
  curl -s -o /dev/null -w '   HTTP %{http_code}\n' \
    "https://tiles.goong.io/assets/goong_map_web.json?api_key=${MAPTILES_KEY}"
  echo
fi

if [ -n "$API_KEY" ]; then
  echo "== 2) Place AutoComplete =="
  curl -s "${REST}/v2/place/autocomplete?api_key=${API_KEY}&input=ben%20xe%20mien%20dong&more_compound=true" \
    | head -c 500
  echo; echo

  echo "== 3) Reverse Geocode =="
  curl -s "${REST}/v2/geocode?latlng=10.8142,106.7108&api_key=${API_KEY}" | head -c 500
  echo; echo

  echo "== 4) Direction (vehicle=truck, alternatives=true) =="
  curl -s "${REST}/v2/direction?origin=10.8142,106.7108&destination=10.7769,106.7009&vehicle=truck&alternatives=true&api_key=${API_KEY}" \
    | head -c 500
  echo; echo
fi

echo "== Kết luận =="
echo "- Mục (1) HTTP 200 -> Maptiles key vẽ được bản đồ."
echo '- Mục (2)(3)(4) có "status": "OK" -> API key gọi được REST.'
echo '- Báo API_KEY_INVALID / HTTP 403 -> dán nhầm key giữa hai ô, hoặc key bị giới hạn domain.'
