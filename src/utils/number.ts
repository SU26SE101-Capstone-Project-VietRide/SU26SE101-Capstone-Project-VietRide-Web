// Ép chuỗi input về number an toàn — giá trị không hợp lệ trả về 0.
export function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}
