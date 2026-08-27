// Cấu hình chung cho Goong Maps — thay Google sau khi key Google bị khoá.
//
// Goong dùng HAI key khác nhau, lấy ở https://account.goong.io:
//  - Maptiles key → vẽ bản đồ (tiles.goong.io). SDK tự nối `api_key=` vào URL
//    style/sprite/glyph/tile thông qua `goongjs.accessToken`.
//  - API key      → REST v2 (rsapi.goong.io): v2/place/*, v2/geocode, v2/direction.
// Điền nhầm chỗ là một trong hai mảng chết im lặng, nên tách hẳn hai biến .env.

const defaultRestBaseUrl = "https://rsapi.goong.io";
const defaultMapStyleUrl = "https://tiles.goong.io/assets/goong_map_web.json";

export const goongMissingApiKeyMessage =
  "Chưa cấu hình VITE_GOONG_API_KEY. Hãy thêm API key Goong (rsapi.goong.io) vào file .env.";
export const goongMissingMaptilesKeyMessage =
  "Chưa cấu hình VITE_GOONG_MAPTILES_KEY. Hãy thêm Maptiles key Goong vào file .env.";

function readEnv(name: string): string {
  const value: unknown = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** API key cho REST (Place/Geocode/Direction). Rỗng = chưa cấu hình. */
export function getGoongApiKey(): string {
  return readEnv("VITE_GOONG_API_KEY");
}

/** Maptiles key cho SDK bản đồ. Rỗng = chưa cấu hình. */
export function getGoongMaptilesKey(): string {
  return readEnv("VITE_GOONG_MAPTILES_KEY");
}

/** Host REST, đã cắt dấu `/` thừa ở cuối để ghép path an toàn. */
export function getGoongRestBaseUrl(): string {
  return (readEnv("VITE_GOONG_REST_BASE_URL") || defaultRestBaseUrl).replace(
    /\/+$/,
    "",
  );
}

/**
 * URL style bản đồ. KHÔNG kèm key ở đây: `goongjs.accessToken` đã tự gắn
 * `api_key=` vào style + sprite + glyph + tile, gắn tay nữa là trùng tham số.
 */
export function getGoongMapStyleUrl(): string {
  return readEnv("VITE_GOONG_MAP_STYLE_URL") || defaultMapStyleUrl;
}

/**
 * Dựng URL REST Goong. `params` bỏ qua giá trị rỗng/undefined để query string
 * không dính tham số thừa. Ném lỗi khi thiếu API key — mọi endpoint REST đều
 * bắt buộc `api_key`, gọi thiếu chỉ tốn một vòng 4xx.
 */
export function buildGoongUrl(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const apiKey = getGoongApiKey();
  if (!apiKey) {
    throw new Error(goongMissingApiKeyMessage);
  }

  const url = new URL(`${getGoongRestBaseUrl()}/${path.replace(/^\/+/, "")}`);
  Object.entries(params).forEach(([name, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    url.searchParams.set(name, String(value));
  });
  url.searchParams.set("api_key", apiKey);

  return url.toString();
}
