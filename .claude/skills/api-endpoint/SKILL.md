---
name: api-endpoint
description: Thêm, sửa hoặc debug endpoint trong src/api/vietride.ts của VietRide. Dùng khi task nhắc tới gọi API mới, wire màn hình với backend, đổi query param/response shape, hoặc test API fail vì URL/header sai. Bao gồm pattern type → function → test assert URL tuyệt đối, và luật idempotency.
---

# Thêm / sửa endpoint VietRide

Toàn bộ API layer nằm trong **một file**: `src/api/vietride.ts` (~4.5k dòng), test đối ứng
`src/api/vietride.test.ts` (~2.6k dòng). Không tạo file API mới, không gọi `fetch` ngoài layer này.

## Bước 0 — Xác minh spec trước khi viết

1. Tìm spec trong `src/docs/api/` (file đặt tên theo domain/ngày: `API-Parcel.md`,
   `API-Day41-43.md`, `API-Invoice-OperatorWallet-Settlement.md`...). Lấy đúng path, method,
   query param, response shape.
2. Đối chiếu quyền trong `src/docs/api-role-map.md` — endpoint `/v1/admin/*` chỉ dành cho
   `SYSTEM_ADMIN`, `/v1/operator/*` cho `OPERATOR_ADMIN`/`OPERATOR_STAFF`.
3. Kiểm tra hàm đã tồn tại chưa: `grep -n "export function get<Domain>" src/api/vietride.ts`.
   File rất lớn và có nhiều biến thể gần giống nhau — trùng tên/trùng path là lỗi hay gặp nhất.

Nếu spec và yêu cầu lệch nhau (thiếu field, path khác), **báo tradeoff rồi dừng**, đừng tự đoán shape.

## Bước 1 — Type

Khai type ngay trên hàm, cùng file. Quy ước sẵn có:

- List có phân trang → `PagedResult<T>` (đã có sẵn: `items/page/pageSize/totalItems/totalPages/hasPreviousPage/hasNextPage`).
- Query param → type riêng, kế thừa `PageParams` khi có `page/pageSize/search/sortBy/sortDir/status`.
- Union chuỗi từ backend luôn nới bằng `| string` như code hiện tại (`type PaymentMethod = "VNPAY" | "WALLET" | string`).
- **Không dùng `any`.** Field chưa rõ shape thì để `unknown` và bóc bằng type guard.

## Bước 2 — Function

`apiRequest<T>` **tự bóc envelope `{ data }`** → generic là kiểu của `data`, không phải envelope.
`buildQuery` tự bỏ `undefined | null | ""`.

```ts
// GET có query
export function getAdminOperatorUsers(params: AdminUserParams = {}) {
  return apiRequest<PagedResult<AdminUser>>(
    `/v1/admin/operator-users${buildQuery(params)}`,
  );
}

// POST có body
export function createAdminLocation(request: AdminLocationRequest) {
  return apiRequest<AdminLocation>("/v1/admin/locations", {
    method: "POST",
    body: request,
  });
}

// PATCH theo id
export function updateAdminLocation(id: string, request: UpdateAdminLocationRequest) {
  return apiRequest<AdminLocation>(`/v1/admin/locations/${id}`, {
    method: "PATCH",
    body: request,
  });
}
```

Không `async/await` khi chỉ return thẳng — chỉ dùng `async` khi phải normalize response
(xem `getAdminUsers` map `id` → `userId`, `getAdminLocations` xử lý cả array lẫn paged).

Biến thể khác:
- Tải file → `apiBlobRequest` (xem `downloadOperatorInvoice`, `exportOperatorReport`).
- Stream → `apiSseRequest(path, options, onEvent)` (xem `chatWithRag`).
- Endpoint public không cần token → `{ authenticated: false }`.

## Bước 3 — Idempotency

`src/api/idempotency.ts` **tự gắn `Idempotency-Key`** cho mọi POST/PUT/PATCH/DELETE, trừ danh
sách exempt (auth, VNPay IPN, rag-config/reload, internal batch). Bình thường **không làm gì thêm**.

Chỉ nhận key qua tham số khi caller cần khoá dedupe ổn định qua nhiều lần retry:

```ts
export function lockAdminUser(userId: string, idempotencyKey = createIdempotencyKey()) {
  return apiRequest<AdminUserActionResult>(`/v1/admin/users/${userId}/lock`, {
    method: "POST",
    body: {},
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
```

Nếu endpoint mới thuộc nhóm webhook/IPN/không nên retry-safe → thêm vào
`IDEMPOTENCY_EXEMPT_OPERATIONS` và thêm case trong `src/api/idempotency.test.ts`.

## Bước 4 — Test (bắt buộc)

Thêm import vào block import đầu `src/api/vietride.test.ts` (danh sách đang sort gần như
alphabet — chèn đúng chỗ) và viết một `it(...)`.

Base URL được pin trong `vitest.config.ts` = `https://api.vietride.online`, nên **assert URL
tuyệt đối kèm nguyên query string theo đúng thứ tự `buildQuery` sinh ra** (thứ tự = thứ tự key
trong object truyền vào).

```ts
it("creates an admin-managed user", async () => {
  localStorage.setItem("auth", JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresInSeconds: 3600,
    user: { id: "user-1", email: "admin@vietride.vn", displayName: "Admin", role: "SYSTEM_ADMIN" },
  }));
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ data: { userId: "user-2" } }), { status: 201 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await createAdminUser({ email: "manager@operator.vn", displayName: "M", role: "OPERATOR_ADMIN" });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.vietride.online/v1/admin/users",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "manager@operator.vn", displayName: "M", role: "OPERATOR_ADMIN" }),
      headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
    }),
  );
});
```

Ghi chú:
- Response mock phải bọc trong `{ data: ... }` để đúng đường bóc envelope.
- `beforeEach` của describe đã `localStorage.clear()` + `vi.restoreAllMocks()` — cần token thì
  tự set `localStorage` trong từng test như trên.
- Hàm có normalize (map field, gộp array→paged) thì assert cả **kết quả trả về**, không chỉ URL.

## Bước 5 — Verify

```bash
npx vitest run src/api/vietride.test.ts
npm run typecheck
```
Rồi chạy skill `verify` trước khi commit.

## Checklist

- [ ] Đã đọc spec trong `src/docs/api/` và role map
- [ ] Không trùng hàm/path đã có
- [ ] Generic của `apiRequest` là kiểu `data`, không phải envelope
- [ ] Không `any` mới
- [ ] Idempotency: để mặc định, hoặc có lý do rõ khi truyền tay / thêm exempt
- [ ] Test assert URL tuyệt đối + query string đúng thứ tự
- [ ] `npx vitest run src/api/vietride.test.ts` xanh
