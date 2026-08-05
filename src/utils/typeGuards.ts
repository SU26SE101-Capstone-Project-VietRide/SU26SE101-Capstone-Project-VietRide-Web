// Type guard dùng chung — thay cho các bản copy cục bộ từng file.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
