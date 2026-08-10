// Khớp địa chỉ tự do của Google Places với danh mục hành chính chính thức.
//
// Điểm dừng bắt buộc gắn Location cấp phường/xã, nhưng luồng thêm điểm là click
// một gợi ý trên bản đồ nên không có ô nào hỏi phường/xã. Các hàm dưới đây đoán
// sẵn để điền vào form xác nhận — KHÔNG dùng để lưu thẳng.
//
// Lý do bắt buộc phải có bước xác nhận: cả `PATCH /v1/operator/stops/{id}` lẫn
// bản admin đều không có field đổi Location, nên đoán sai một lần là điểm dừng
// sai vĩnh viễn, chỉ sửa được bằng cách disable rồi tạo lại.
import type { AdminLocation } from "../api/vietride";

/** Độ dài tối thiểu để cho phép khớp chuỗi con — tránh "1" khớp bừa */
const MIN_PARTIAL_MATCH_LENGTH = 4;

const ADMINISTRATIVE_PREFIX =
  /^(?:tinh|thanh pho|tp|quan|huyen|thi xa|phuong|xa|thi tran|dac khu)\s+/;

export function normalizeLocationName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(ADMINISTRATIVE_PREFIX, "")
    .trim();
}

/** Tách địa chỉ Google thành các mảnh đã chuẩn hoá, bỏ phần quốc gia */
export function addressSegments(address: string): string[] {
  return address
    .split(",")
    .map((segment) => normalizeLocationName(segment))
    .filter((segment) => segment.length > 0 && segment !== "viet nam");
}

/** Mã tỉnh/thành đoán được từ địa chỉ; "" khi không khớp mảnh nào */
export function matchProvinceCode(
  address: string,
  city: string | undefined,
  provinces: AdminLocation[],
): string {
  const segments = [
    ...(city ? [normalizeLocationName(city)] : []),
    ...addressSegments(address),
  ].filter(Boolean);

  const match = provinces.find((province) =>
    segments.includes(normalizeLocationName(province.name)),
  );
  return match?.code ?? "";
}

/**
 * Id phường/xã đoán được. Chỉ trả về khi khớp **đúng một** — mơ hồ hoặc không
 * khớp đều trả "" để form bắt người dùng tự chọn.
 */
export function matchWardId(
  address: string,
  wards: AdminLocation[],
): string {
  const segments = addressSegments(address);
  if (segments.length === 0) return "";

  const matchedIds = new Set(
    wards
      .filter((ward) => {
        const name = normalizeLocationName(ward.name);
        if (!name) return false;
        return segments.some(
          (segment) =>
            segment === name ||
            (segment.length >= MIN_PARTIAL_MATCH_LENGTH &&
              name.includes(segment)) ||
            (name.length >= MIN_PARTIAL_MATCH_LENGTH &&
              segment.includes(name)),
        );
      })
      .map((ward) => ward.id),
  );

  return matchedIds.size === 1 ? [...matchedIds][0] : "";
}
