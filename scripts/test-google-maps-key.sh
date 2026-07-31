#!/usr/bin/env bash
# Test nhanh xem Google Maps API key có dùng được không, không cần mở trình duyệt.
# Chạy được trên Google Cloud Shell hoặc Git Bash local.
#
# Cách dùng:
#   ./scripts/test-google-maps-key.sh                # tự đọc key từ file .env ở repo root
#   ./scripts/test-google-maps-key.sh <API_KEY>       # truyền key trực tiếp
#
# Script không sửa gì trên Google Cloud, chỉ gọi các endpoint public để đọc phản hồi.

set -uo pipefail

KEY="${1:-}"

if [ -z "$KEY" ]; then
  if [ -f .env ]; then
    KEY=$(grep '^VITE_GOOGLE_MAPS_API_KEY=' .env | cut -d= -f2 | tr -d '\r')
  fi
fi

if [ -z "$KEY" ]; then
  echo "Không tìm thấy key. Dùng: ./scripts/test-google-maps-key.sh <API_KEY>"
  exit 1
fi

REFERER="http://localhost:5173/"
MASKED="${KEY:0:6}...${KEY: -6}"

echo "Key đang test: $MASKED"
echo "Referer giả lập: $REFERER"
echo

echo "== 1) Maps JavaScript API (bootstrap script) =="
resp=$(curl -s -H "Referer: $REFERER" "https://maps.googleapis.com/maps/api/js?key=${KEY}&v=quarterly")
case "$resp" in
  *google.maps.Load*)
    echo "OK — script tải được, key + referrer hợp lệ cho Maps JavaScript API."
    ;;
  *)
    echo "FAIL — không thấy nội dung script hợp lệ. Phản hồi (rút gọn):"
    printf '%s\n' "$resp" | head -c 500
    ;;
esac
echo
echo

echo "== 2) Geocoding API (REST trực tiếp) =="
echo "Lưu ý: key giới hạn theo Website (HTTP referrer) không dùng được cho REST endpoint gọi trực"
echo "tiếp như curl — nếu thấy 'REQUEST_DENIED: API keys with referer restrictions cannot be used"
echo "with this API' thì ĐÓ LÀ BÌNH THƯỜNG, không phải lỗi. Chỉ cần không phải lỗi billing/quota là được."
resp=$(curl -s "https://maps.googleapis.com/maps/api/geocode/json?latlng=10.8142,106.7108&key=${KEY}")
echo "$resp"
echo

echo "== 3) Places API (New) — Autocomplete REST =="
resp=$(curl -s -X POST "https://places.googleapis.com/v1/places:autocomplete" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: ${KEY}" \
  -H "Referer: ${REFERER}" \
  -d '{"input": "Ben xe Mien Dong"}')
echo "$resp"
echo

echo "== Kết luận =="
echo "- Nếu mục (3) trả về JSON có \"suggestions\" -> Places API (New) đã hoạt động."
echo "- Nếu mục (3) báo lỗi PERMISSION_DENIED / 'caller does not have permission' -> billing Maps"
echo "  Platform (Maps-only billing, bắt buộc riêng với tài khoản Ấn Độ) chưa được thiết lập xong,"
echo "  hoặc thay đổi vừa lưu chưa kịp áp dụng (đợi vài phút rồi chạy lại script)."
