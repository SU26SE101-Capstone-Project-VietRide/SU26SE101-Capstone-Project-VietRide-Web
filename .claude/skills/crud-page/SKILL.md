---
name: crud-page
description: Dựng hoặc mở rộng màn hình Admin/Manager của VietRide theo đúng convention repo — list + filter + phân trang + modal form + alert + i18n + route phân quyền + test. Dùng khi task là "làm màn X", "thêm trang quản lý Y", "thêm bảng/bộ lọc/modal vào màn Z".
---

# Dựng màn Admin / Manager

Tham chiếu chuẩn: `src/pages/Admin/Stations/index.tsx` (form + merge + phân trang),
`src/pages/Manager/Staff/index.tsx`, và test đối ứng `src/pages/Admin/Stations/index.test.tsx`.

## Vị trí file

- Màn đơn giản, một file → `src/pages/Admin/Users.tsx`
- Màn có sub-component/helper → thư mục `src/pages/Admin/Stations/index.tsx`
- Test luôn đặt cạnh: `index.test.tsx` hoặc `Users.test.tsx`
- Helper thuần (không JSX) tách file riêng cùng thư mục để test độc lập
  (mẫu: `src/pages/Manager/Routes/polyline.ts` + `polyline.test.ts`)

Không tạo `src/hooks/` hay `src/utils/` mới cho logic chỉ dùng ở một màn — giữ trong page.

## Khung một màn

```tsx
export default function AdminStations() {
  const { t } = useTranslation("admin");        // "manager" nếu là màn Manager
  const { t: tc } = useTranslation("common");   // nút/nhãn dùng chung
  const [items, setItems] = useState<AdminStation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);   // ++ để refetch sau khi mutate
  const [page, setPage] = useState(1);
  const pageSize = 8;
```

`type AlertState = { tone: "success" | "error"; message: string }` — mọi màn dùng chung shape này.

## Fetch

`useEffect` + cờ `ignore` (không dùng AbortController ở các màn hiện có), gọi song song bằng
`Promise.all`, luôn có `try/catch/finally`:

```tsx
useEffect(() => {
  let ignore = false;

  async function load() {
    setIsLoading(true);
    try {
      const [result, locationResult] = await Promise.all([
        getAdminStations({ page: 1, pageSize: 100, sortBy: "updatedAt", sortDir: "desc" }),
        getAdminLocations({ page: 1, pageSize: 100, sortBy: "sortOrder", sortDir: "asc" }),
      ]);
      if (ignore) return;
      setItems(result.items);
    } catch (error) {
      if (ignore) return;
      setItems([]);
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : t("stations.loadFailed"),
      });
    } finally {
      if (!ignore) setIsLoading(false);
    }
  }

  void load();
  return () => { ignore = true; };
}, [reloadKey, t]);
```

Lỗi API đã là message người đọc được (`client.ts` bóc `error.message` từ envelope) → hiển thị
thẳng, chỉ fallback sang key i18n khi không phải `Error`.

Phân trang: các màn hiện tại fetch `pageSize: 100` rồi cắt trang client-side bằng `useMemo`.
Chỉ chuyển sang phân trang server khi dữ liệu thực sự lớn — và khi đó phải đưa `page` vào deps.

## Component dùng lại (đừng viết mới)

| Component | Props chính |
|---|---|
| `Pagination` | `page, pageSize, totalItems, onPageChange` |
| `Modal` | `open, onClose, title, subtitle?, icon?, footer?, wide?` |
| `CustomSelect` | dùng như `<select>`, nhận `<option>` con, `onChange` trả `{ target: { value } }` |
| `CustomDateTimeInput` | input ngày giờ |
| `PlacePicker` | chọn địa điểm Google Places → `PlaceSelection` |
| `CurrencyInput` | nhập tiền VND |
| `DetailLayout` | khung trang chi tiết |

Icon: `react-icons/fi` (`FiPlus`, `FiEdit2`, `FiSearch`, `FiRefreshCw`, `FiX`, `FiSave`...).
Format ngày: `formatDateTime` từ `src/utils/date.ts`. Export CSV: `src/utils/csv.ts`.

## Style

Tailwind v4, token `--color-vr-*` (`vr-500`, `vr-100`) khai trong `src/App.css`.
Class lặp lại thì khai const ở đầu file — pattern đang dùng:

```tsx
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
```

Không tạo file CSS riêng, không dùng inline `style` cho thứ Tailwind làm được.

## i18n

Mọi chuỗi hiển thị đi qua `t(...)`. Key gom theo màn trong namespace tương ứng:
`admin.json` → `stations.*`, `manager.json` → `staff.*`. Thêm key phải làm **cả `vi/` và `en/`** —
chạy skill `i18n-sync` sau khi thêm.

## Route + phân quyền

Trong `src/App.tsx`: lazy import + đặt trong nhánh `PrivateRoute` đúng vai trò.

```tsx
const AdminStations = lazy(() => import("./pages/Admin/Stations"));
// ...
<Route element={<PrivateRoute allowedRoles={["SYSTEM_ADMIN"]} />}>
  <Route path="/admin/stations" element={<AdminStations />} />
</Route>
```

`AuthRole = "SYSTEM_ADMIN" | "OPERATOR_ADMIN" | "OPERATOR_STAFF"`. Đối chiếu
`src/docs/api-role-map.md` — màn không được gọi endpoint ngoài quyền của vai trò đó.
Thêm mục sidebar thì cập nhật `src/components/Sidebar.tsx` + `nav.json` (vi + en).

## Test

Mock cả API module lẫn i18n; `t` trả về chính key nên assert theo key, không theo tiếng Việt:

```tsx
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

vi.mock("../../../api/vietride", () => ({
  getAdminStations: vi.fn(),
  updateAdminStation: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminStations).mockResolvedValue({
    items: [station], page: 1, pageSize: 100, totalItems: 1, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false,
  });
});
```

Component nặng (map, 3D, PlacePicker) mock bằng stub tối giản:
```tsx
vi.mock("../../../components/PlacePicker", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
```

Ít nhất phải phủ: render danh sách, một luồng mutate thành công (assert hàm API được gọi đúng
tham số), và một luồng lỗi (assert message lỗi hiện ra). Dùng `userEvent` + `waitFor`.

## Checklist

- [ ] Đặt đúng chỗ (`Admin/` hay `Manager/`), test đặt cạnh file
- [ ] Dùng lại `Pagination` / `Modal` / `CustomSelect`, không viết trùng
- [ ] `useEffect` có cờ `ignore` + `finally` tắt loading
- [ ] Không hardcode chuỗi; key thêm đủ vi + en
- [ ] Route bọc `PrivateRoute` đúng vai trò + sidebar cập nhật
- [ ] Không `any`; type import từ `src/api/vietride`
- [ ] Test render + mutate + error đều xanh
- [ ] Chạy skill `verify`
