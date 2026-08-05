# CLAUDE.md — VietRide Frontend

Web console cho VietRide (nhà xe / vận tải hành khách + hàng hoá). Hai vai trò UI:
**Admin** (SYSTEM_ADMIN) và **Manager** (OPERATOR_ADMIN / OPERATOR_STAFF).

Comment trong code viết tiếng Việt (theo convention sẵn có), code + identifier viết tiếng Anh.

## Lệnh

```bash
npm run dev         # Vite dev server
npm run typecheck   # tsc -b
npm run lint        # eslint .
npm test            # vitest run
npm run build       # tsc -b && vite build
```

Chạy đúng thứ tự trên khi verify — đó là thứ tự CI (`.github/workflows/ci.yml`) và
build là bước duy nhất bắt lỗi import sai hoa/thường (Linux phân biệt, Windows thì không).
Dùng skill `verify` cho bước này.

## Stack

React 19 · TypeScript 6 · Vite 8 · Tailwind 4 (`@tailwindcss/vite`, không có tailwind.config)
· react-router-dom 7 · i18next · Zustand · Recharts · Firebase (Storage + custom token)
· Leaflet + Google Maps/Routes · Vitest 4 + Testing Library (jsdom).

## Bản đồ code

```
src/
├── api/
│   ├── client.ts        # apiRequest / apiBlobRequest / apiSseRequest / buildQuery
│   ├── idempotency.ts   # tự gắn Idempotency-Key cho mutation
│   └── vietride.ts      # ~4.5k dòng: toàn bộ type + endpoint function (1 file duy nhất)
├── auth.ts              # session trong localStorage key "auth", refresh token, AuthRole
├── components/          # UI dùng chung: Modal, Pagination, CustomSelect, PlacePicker...
├── pages/Admin/*        # màn Admin
├── pages/Manager/*      # màn Manager
├── modules/vehicle-builder/   # feature module 3D (three/fiber/drei)
├── i18n/                # 5 namespace × vi/en
├── lib/                 # googleMaps, googlePlaces
├── utils/               # csv, date, phone, firebaseImageUpload
└── docs/                # spec API theo ngày + api-role-map.md (đọc trước khi thêm endpoint)
```

## Luật bắt buộc

**API layer**
- Mọi request đi qua `src/api/client.ts`. Không gọi `fetch` trực tiếp trong page/component.
- `apiRequest` tự bóc envelope `{ data }` → type generic là **kiểu của `data`**, không phải envelope.
- 401 + có refreshToken → tự refresh và retry **một lần**. Đừng viết lại logic này ở tầng trên.
- Endpoint mới luôn thêm vào `src/api/vietride.ts` + test tương ứng trong `vietride.test.ts`.
  Dùng skill `api-endpoint`.

**Idempotency**
- `addIdempotencyHeader` tự gắn key cho POST/PUT/PATCH/DELETE, trừ danh sách exempt trong
  `src/api/idempotency.ts` (auth, IPN, rag-config/reload, internal batch).
- Chỉ truyền `idempotencyKey` thủ công khi caller cần khoá dedupe ổn định giữa nhiều lần
  retry (xem `lockAdminUser` / `unlockAdminUser`).

**i18n**
- 5 namespace: `common` (default), `nav`, `login`, `admin`, `manager`. Fallback `vi`.
- Thêm/sửa key phải làm **cả `vi/` và `en/`**. Hiện đang parity 100% (2.286 key mỗi ngôn ngữ) —
  giữ nguyên trạng thái đó. Dùng skill `i18n-sync`.
- Không hardcode chuỗi hiển thị trong page.

**Test**
- Vitest `globals: true`, `jsdom`, setup `src/test/setup.ts` (import `../i18n` + cleanup).
- `VITE_API_BASE_URL` được **pin trong `vitest.config.ts`** = `https://api.vietride.online`.
  Test không đọc `.env` (file bị gitignore). Assert URL tuyệt đối, đừng đổi sang relative.
- Test API: `vi.stubGlobal("fetch", ...)` + assert URL đầy đủ kèm query string.
- Test page: `vi.mock` module `../../../api/vietride` và mock `react-i18next` trả về key.

**TypeScript**
- Không thêm `any` mới. Ưu tiên `unknown` + type guard (`isRecord` pattern có sẵn).

**Routing / phân quyền**
- Route lazy-load trong `src/App.tsx`, bọc `PrivateRoute allowedRoles={[...]}`.
- `AuthRole = "SYSTEM_ADMIN" | "OPERATOR_ADMIN" | "OPERATOR_STAFF"`. Đối chiếu
  `src/docs/api-role-map.md` trước khi gắn endpoint vào màn.

**Styling**
- Tailwind v4, theme token `--color-vr-*` khai trong `src/App.css` (dùng `vr-500`, `vr-100`...).
- Class dài lặp lại thì khai `const inputClass = "..."` ở đầu file page (pattern hiện có),
  không tách file CSS riêng.

**Môi trường**
- `.npmrc` bật `legacy-peer-deps=true` vì `@react-three/drei@9` khai peer `react@18` còn
  project chạy `react@19`. Xoá dòng đó là `npm ci` fail trên CI và Docker.

## Skills của dự án

| Skill | Dùng khi |
|---|---|
| `api-endpoint` | Thêm/sửa endpoint trong `src/api/vietride.ts` |
| `crud-page` | Dựng màn Admin/Manager mới (table + filter + modal + i18n) |
| `i18n-sync` | Thêm key dịch hoặc kiểm tra parity vi/en |
| `verify` | Trước khi commit/push — chạy đúng pipeline CI |

## Ghi chú

- `CODE_CONVENTIONS.md` (root) là quy chuẩn chi tiết về cấu trúc thư mục, ngưỡng tách
  component, hooks, naming — đọc khi dựng màn mới hoặc refactor. Cùng thứ tự ưu tiên với
  file này.
- `AGENTS.md` là prompt cho tool khác (CodeGraph/Ponytail/Superpower). Phần rule kỹ thuật
  đã được rút gọn vào file này; khi hai bên mâu thuẫn, **CLAUDE.md thắng** vì nó bám fact repo.
- `README.md` vẫn là boilerplate Vite, chưa mô tả dự án — đừng lấy làm nguồn tham chiếu.
- File to nhất: `src/api/vietride.ts` (4.5k), `src/pages/Manager/Routes/index.tsx` (2k),
  `src/pages/Admin/Vouchers.tsx` (1.6k). Đọc theo `offset`/`limit`, đừng load cả file.
