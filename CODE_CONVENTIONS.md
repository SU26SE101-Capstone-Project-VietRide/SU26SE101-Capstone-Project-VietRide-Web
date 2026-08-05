# CODE_CONVENTIONS.md — Quy chuẩn code VietRide Frontend

Tài liệu này là **chuẩn bắt buộc cho code mới** và là **đích đến khi refactor code cũ**.
Nguyên tắc chung: không refactor ồ ạt cả repo một lúc — áp dụng "boy-scout rule":
chạm vào màn nào thì đưa màn đó về chuẩn.

Khi tài liệu này mâu thuẫn với `AGENTS.md`, tài liệu này thắng (cùng thứ tự ưu tiên với
`CLAUDE.md` — hai file bám fact repo).

---

## 1. Cấu trúc thư mục chuẩn

```
src/
├── api/                  # Tầng API duy nhất (client.ts, idempotency.ts, vietride.ts)
├── assets/               # Ảnh, logo, static assets
├── components/           # Component dùng chung ≥ 2 màn
│   └── form/             # (mới) Form primitives: Field, TextInput, NumberInput, DurationInput...
├── config/               # Khởi tạo SDK bên thứ ba (firebase.ts)
├── hooks/                # (mới) Custom hook dùng chung ≥ 2 màn
├── i18n/                 # 5 namespace × vi/en
├── layouts/              # AdminLayout, ManagerLayout
├── lib/                  # Wrapper dịch vụ ngoài (googleMaps, googlePlaces, trackingSocket)
├── modules/              # Feature module lớn, tự chứa (vehicle-builder)
├── pages/
│   ├── Admin/            # Mỗi màn 1 THƯ MỤC (xem §2)
│   └── Manager/
├── test/                 # setup.ts
└── utils/                # Hàm thuần, không phụ thuộc React (csv, date, phone...)
```

Quy tắc đặt chỗ:

| Loại code | Đặt ở |
|---|---|
| Component chỉ 1 màn dùng | File riêng **trong thư mục màn đó** |
| Component ≥ 2 màn dùng | `src/components/` |
| Form primitive (Input, Field, Select...) | `src/components/form/` |
| Hook chỉ 1 màn dùng | Trong thư mục màn đó (`useXxx.ts`) |
| Hook ≥ 2 màn dùng | `src/hooks/` |
| Hàm thuần không dính React | `src/utils/` |
| Wrapper API/SDK bên ngoài | `src/lib/` hoặc `src/config/` |
| Type của API | `src/api/vietride.ts` (duy nhất) |
| Type cục bộ của màn | Đầu file dùng nó, hoặc `types.ts` trong thư mục màn |

**Cấm:** tạo `src/types/` chung chung, tạo file CSS riêng, gọi `fetch` ngoài `src/api/client.ts`.

---

## 2. Cấu trúc một màn (page)

**Mọi màn mới đều là thư mục**, kể cả Admin (chuẩn hoá theo Manager — các file phẳng
`Admin/Vouchers.tsx`, `Admin/Operators.tsx`... là legacy, khi sửa lớn thì chuyển thành thư mục):

```
src/pages/Manager/Routes/
├── index.tsx             # Component màn chính: state + wiring, KHÔNG chứa sub-component lớn
├── index.test.tsx        # Test màn
├── RouteFormModal.tsx    # Modal tạo/sửa — tách file riêng
├── RouteDesignMap.tsx    # Sub-component lớn — tách file riêng
├── useRouteFilters.ts    # Hook cục bộ (nếu có)
├── types.ts              # Type cục bộ (nếu > ~5 type)
└── polyline.ts           # Helper thuần cục bộ
```

### Ngưỡng bắt buộc tách file

| Tình huống | Quy tắc |
|---|---|
| `index.tsx` vượt **500 dòng** | Phải tách sub-component / hook ra file riêng |
| Sub-component **> 50 dòng** | Không được định nghĩa inline trong file page — tách file riêng cùng thư mục |
| Sub-component ≤ 50 dòng, chỉ page đó dùng | Được phép inline, đặt **sau** component page |
| Sub-component xuất hiện ở **màn thứ 2** | Chuyển ngay lên `src/components/` (đừng copy-paste) |
| Modal có form | Luôn là file riêng `XxxModal.tsx`, nhận `open/onClose/onSubmit` qua props |
| File bất kỳ vượt **800 dòng** | Không được merge thêm code vào — phải tách trước |

Hiện trạng vi phạm (đích refactor dần, không sửa một lượt): `Manager/Routes/index.tsx` (2.134),
`Admin/Vouchers.tsx` (1.659), `Manager/Vehicles/index.tsx` (1.504), `Manager/Packages/index.tsx`
(1.302), `Manager/Dispatch/index.tsx` (1.296)...

### Thứ tự nội dung trong `index.tsx` (giữ pattern sẵn có)

```tsx
// 1. Imports (react → thư viện → api → components → utils, type import dùng `type`)
// 2. Hằng class Tailwind:  const inputClass = "..."; const labelClass = "...";
// 3. Type cục bộ:          type AlertState = { tone: "success" | "error"; message: string };
// 4. Hằng form rỗng:       const emptyForm: RouteForm = {...};
// 5. Helper thuần:         function toForm(...) {...}  function isRecord(...) {...}
// 6. Component màn:        export default function RoutesPage() {...}
// 7. Sub-component nhỏ (≤ 50 dòng) nếu có
```

---

## 3. Component

- **File PascalCase, `export default function TênComponent()`** — tên function trùng tên file.
  (Bỏ rule "named exports" trong AGENTS.md — repo đã thống nhất default export.)
- Ngoại lệ: file nhóm nhiều component siêu nhỏ liên quan chặt (như `DetailLayout.tsx` export
  `DetailItem` + `DetailSection`) — dùng named export, tối đa ~3 component/file.
- Component màn đặt tên `TênMànPage` (`RoutesPage`, `StationsPage`) — thống nhất hậu tố `Page`,
  và alias lazy-import trong `App.tsx` đặt trùng tên đó.
- Props: khai `type XxxProps` ngay trên component. Không dùng `React.FC`.
- Component nhận dữ liệu qua props, **không tự gọi API** trừ khi nó là màn (page) hoặc
  component tự chứa có lý do rõ (upload ảnh, autocomplete...).
- Type mà component export cho bên ngoài dùng (`PlaceSelection`, `GoogleMapMarker`) khai và
  export ngay trong file component đó.
- Dùng lại component sẵn có trước khi viết mới: `Modal`, `Pagination`, `CustomSelect`,
  `CustomDateTimeInput`, `CurrencyInput`, `PlacePicker`, `GoogleMapCanvas`, `InlineAlert`,
  `DetailLayout`. **Cấm** viết lại modal/pagination inline.

### Việc tách form primitives (nợ kỹ thuật cần trả dần)

`Field`, `Input`, `NumberInput`, `DurationInput`, `StationSelect`... đang bị định nghĩa lặp
trong từng page (Routes, Vouchers...). Chuẩn mới: khi chạm vào một page có các component này,
chuyển chúng vào `src/components/form/` và import lại. Không tạo thêm bản copy mới.

---

## 4. Hooks & tái sử dụng logic

Tạo `src/hooks/` cho logic lặp ≥ 2 màn. Ba pattern đang bị copy-paste khắp nơi, khi chạm vào
thì extract theo chuẩn:

```ts
// src/hooks/useAlert.ts — thay cho useState<AlertState | null> lặp ở mỗi page
// src/hooks/usePagination.ts — page + pageSize + setPage(1) khi filter đổi
// src/hooks/useListQuery.ts — useEffect + async load + ignore-flag + reloadKey + isLoading
```

Quy tắc viết hook:
- Tên `useXxx`, file camelCase `useXxx.ts`, co-locate test `useXxx.test.ts`.
- Hook không render JSX. Logic fetch trong hook vẫn phải đi qua `src/api/vietride.ts`.
- Đừng extract quá sớm: dùng ở màn thứ 2 mới đưa lên `src/hooks/`.

---

## 5. State

- **Mặc định: state cục bộ** (`useState`/`useReducer`) trong page. Đây là chuẩn của repo.
- Zustand chỉ dùng khi state phải sống **xuyên nhiều màn/route** (hiện chỉ có
  `vehicle-builder/stores/vehicleStore.ts`). Store mới đặt trong module dùng nó, kèm test.
- Auth/session: chỉ qua `src/auth.ts` (localStorage key `"auth"`) — không đọc/ghi
  localStorage auth ở chỗ khác.
- URL là nguồn state cho filter cần share/bookmark (`useSearchParams`), còn lại filter là
  local state; đổi filter phải `setPage(1)`.

---

## 6. API layer (tóm tắt luật từ CLAUDE.md — bắt buộc)

- Mọi request qua `src/api/client.ts`; endpoint + type khai trong `src/api/vietride.ts`
  kèm test trong `vietride.test.ts` assert **URL tuyệt đối** (skill `api-endpoint`).
- `apiRequest<T>`: `T` là kiểu của `data` đã bóc envelope.
- Không tự viết logic refresh 401 — client đã làm, retry đúng 1 lần.
- Idempotency-Key tự gắn cho mutation; chỉ truyền tay khi cần key ổn định giữa các retry.
- Gắn endpoint vào màn phải đối chiếu `src/docs/api-role-map.md` đúng role.

---

## 7. i18n (bắt buộc)

- 5 namespace: `common` (default), `nav`, `login`, `admin`, `manager`. Fallback `vi`.
- **Không hardcode chuỗi hiển thị.** Key camelCase, lồng theo màn:
  `manager.routes.form.nameLabel`. Độ sâu tối đa 4 cấp.
- Thêm/sửa key phải làm cả `vi/` và `en/`, giữ parity 100% (skill `i18n-sync`).
- Alias khi cần 2 namespace: `const { t } = useTranslation("manager");`
  `const { t: tc } = useTranslation("common");`

---

## 8. Styling

- Tailwind v4, token `--color-vr-*` trong `src/App.css` (`vr-500`, `vr-100`...). Không tạo
  file CSS riêng, không inline `style=` trừ giá trị động (toạ độ, %).
- Chuỗi class lặp trong 1 page → hằng `const inputClass = "..."` đầu file (pattern sẵn có).
- Chuỗi class lặp **giữa nhiều page** → đó là dấu hiệu cần component trong
  `src/components/form/`, không phải copy hằng sang page mới.
- Trạng thái alert: dùng tone `success`/`error` với emerald/rose như hiện tại; ưu tiên dùng
  component `InlineAlert` thay vì tự render div.

---

## 9. TypeScript

- **Không thêm `any` mới.** Dữ liệu ngoài (API, JSON) → `unknown` + type guard
  (pattern `isRecord` sẵn có).
- Ưu tiên `type` alias (repo gần như không dùng `interface` — giữ nguyên).
- Import type dùng inline specifier: `import { getX, type X } from "../../api/vietride"`.
- Hằng module-level export dùng SCREAMING_SNAKE (`MAX_FIREBASE_IMAGE_SIZE_BYTES`); hằng cục
  bộ trong file dùng camelCase (`emptyForm`, `inputClass`).

---

## 10. Routing & phân quyền

- Route lazy-load trong `src/App.tsx`, bọc `PrivateRoute allowedRoles={[...]}`.
- `AuthRole = "SYSTEM_ADMIN" | "OPERATOR_ADMIN" | "OPERATOR_STAFF"`.
- Màn Admin → `SYSTEM_ADMIN`; màn Manager → `OPERATOR_ADMIN` (± `OPERATOR_STAFF` theo
  `api-role-map.md`).

---

## 11. Test

- Vitest 4 + Testing Library, jsdom, `globals: true`. Test **co-locate** cạnh file nguồn:
  `Xxx.test.tsx`, page thư mục thì `index.test.tsx`.
- **Màn mới bắt buộc có test** (render + load list + 1 flow chính). Sub-component tách ra
  file riêng nếu có logic thì test riêng.
- Test API: `vi.stubGlobal("fetch", ...)`, assert URL tuyệt đối
  (`https://api.vietride.online/...` — pin trong `vitest.config.ts`) kèm query string.
- Test page: `vi.mock` module `../../../api/vietride`; mock `react-i18next` trả về key.
- Trước khi commit/push: chạy đúng thứ tự CI `typecheck → lint → test → build`
  (skill `verify`).

---

## 12. Quy tắc dọn rác (áp dụng khi chạm vào file liên quan)

Nợ kỹ thuật đã ghi nhận — **không sửa ồ ạt**, chạm tới đâu dọn tới đó:

1. Page phẳng trong `Admin/` → chuyển thành thư mục khi có thay đổi lớn ở màn đó.
2. Form primitives inline (`Field`, `Input`, `NumberInput`...) → gom về `src/components/form/`.
3. Alert state tự chế → `InlineAlert` + (sau này) `useAlert`.
4. `src/data/mockData.ts` (1.118 dòng): không import thêm vào code mới; xoá dần phần không
   còn dùng.
5. Component share chưa có test (`CustomSelect`, `Pagination`, `PlacePicker`...) → viết test
   khi sửa hành vi của chúng.
6. File > 800 dòng (§2): mỗi lần thêm feature vào các file này phải tách phần liên quan ra
   trước, không cộng dồn thêm.

---

## 13. Checklist tạo màn mới (tóm tắt — chi tiết dùng skill `crud-page`)

- [ ] Thư mục `src/pages/<Role>/<TênMàn>/` với `index.tsx` (< 500 dòng) + `index.test.tsx`
- [ ] Modal form tách file `XxxModal.tsx`; sub-component > 50 dòng tách file
- [ ] Endpoint + type trong `vietride.ts` + test URL tuyệt đối; check `api-role-map.md`
- [ ] i18n đủ `vi` + `en`, không hardcode chuỗi
- [ ] Route lazy trong `App.tsx` + `PrivateRoute` đúng role + item Sidebar
- [ ] Dùng `Modal`/`Pagination`/`CustomSelect`/`InlineAlert` sẵn có, không viết lại
- [ ] Không `any` mới, không `fetch` trực tiếp
- [ ] `verify` xanh (typecheck → lint → test → build)
