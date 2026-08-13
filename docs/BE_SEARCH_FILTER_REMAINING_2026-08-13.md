# [FE → BE] Đã tích hợp xong, còn 3 mục chưa chuyển được

> Ngày: 2026-08-13
> Trả lời cho `FE-RESPONSE-SEARCH_FILTER_GAP.md`
> Trạng thái FE: **đã tích hợp toàn bộ phần BE bàn giao**, trừ 3 mục dưới đây.

## 1. Checklist bàn giao — trạng thái

| Mục trong checklist BE | FE |
|---|---|
| Bỏ `isOneTime` và card lịch một lần | ✅ xong |
| Route gửi `isActive`, không gửi `status` | ✅ xong |
| Vehicle dùng đúng `status` enum và `isActive` riêng | ✅ xong |
| Location chuyển server-side, bỏ fetch-all | ✅ xong — từ 34 request còn 1 |
| Station chuyển server-side, bỏ fetch-all | ✅ xong |
| Station card dùng `/v1/admin/stations/summary` | ✅ xong |
| Station merge picker dùng list search/paging | ✅ xong |
| Booking ô tổng quát gửi `search` | ✅ xong — đã bỏ heuristic `isPhoneSearch` |
| Settlement/Platform transaction bỏ client-filter | ✅ xong |
| Voucher hệ thống chuyển server-side | ✅ xong |
| **Voucher nhà xe chuyển server-side** | ❌ **chặn — xem §2.1** |
| **Bảng giá hàng chuyển server-side** | ❌ **chặn — xem §2.2** |
| Policies dùng `active`, không dùng `isActive` | ✅ không đổi — FE chưa có UI search cho màn này |
| Không gọi hai `/internal/v1/...` endpoint | ✅ không gọi |
| Reset page khi search/filter đổi | ✅ xong |
| Debounce search | ✅ xong — 350ms |

## 2. Ba mục chưa chuyển được

Nguyên tắc FE áp dụng: **không chuyển nửa vời**. Nếu đẩy `search` lên server mà
giữ một filter khác ở client, filter đó chỉ còn tác dụng trên đúng trang đang
xem — sai hơn hiện trạng. Nên ba màn dưới đây giữ nguyên cho tới khi có đủ tham
số.

### 2.1. `GET /v1/operator/vouchers` — thiếu `type`

Màn: `src/pages/Manager/Vouchers/index.tsx`

Allow-list hiện tại: `isActive, search, service, page, pageSize, sortBy, sortDir`

Màn có **bốn** bộ lọc: từ khoá, trạng thái, dịch vụ (tab BOOKING/PARCEL), và
**loại giảm giá**. Cái thứ tư không có trong allow-list:

| Tham số cần thêm | Kiểu | Giá trị |
|---|---|---|
| `type` | `string?` | `PERCENT_OFF` \| `FIXED_AMOUNT` |

Thêm chi tiết: màn này **chưa có phân trang**, đang render toàn bộ danh sách.
Chuyển sang server-side mà không thêm phân trang thì mặc định `pageSize=20` sẽ
âm thầm cắt mất voucher thứ 21 trở đi. FE sẽ thêm phân trang cùng lúc với việc
gắn `type` — làm một lần cho gọn.

Đối chiếu: `/v1/admin/vouchers` không cần `type` vì màn Admin không có bộ lọc
này, nên bản admin đã chuyển xong.

### 2.2. `GET /v1/operator/parcel-route-fares` — thiếu `sortBy`/`sortDir`

Màn: `src/pages/Manager/Parcels/index.tsx`, tab bảng giá theo tuyến

Allow-list hiện tại: `routeId, sizeCategory, page, pageSize, search`

`search` đã dùng được, nhưng màn còn một dropdown **sắp xếp theo giá**
(giá tăng dần / giảm dần) đang chạy ở client. Sắp xếp mà chỉ áp trên trang hiện
tại thì thứ tự sai hoàn toàn.

| Tham số cần thêm | Kiểu | Giá trị |
|---|---|---|
| `sortBy` | `string?` | `priceVnd` (đủ cho nhu cầu hiện tại) |
| `sortDir` | `string?` | `asc` \| `desc` |

Vướng thứ hai, độc lập với sort: modal tạo/sửa giá có ô chọn tuyến hiển thị
**tóm tắt giá đã cấu hình của từng tuyến** (`getRouteFareSummary`). Cái đó cần
biết toàn bộ fare, không suy được từ một trang. Hai hướng:

- BE trả thêm một endpoint tóm tắt, ví dụ
  `GET /v1/operator/parcel-route-fares/summary` → `[{ routeId, sizeCategory, priceVnd }]`
  hoặc dạng đếm theo tuyến; **hoặc**
- BE cho `GET /v1/operator/routes` trả kèm cờ đã-có-bảng-giá.

Chọn hướng nào cũng được, báo lại để FE gắn.

### 2.3. Khái niệm "lịch chạy một lần" còn sót ở luồng ghi

Màn: `src/pages/Manager/Trips/index.tsx`

Phía **đọc** đã xử lý xong theo đúng yêu cầu: bỏ `isOneTime` khỏi query và bỏ
thẻ thống kê.

Nhưng form tạo/sửa lịch chạy vẫn còn **công tắc "lịch chạy một lần"**. Khi bật,
FE gửi `validUntil = validFrom` và bỏ qua ràng buộc thứ-trong-tuần.

Đã grep toàn bộ `apps/trip/src`: **không có `IsOneTime`/`one_time` ở bất kỳ đâu**
— không có trong query, DTO, entity hay migration. Nghĩa là khái niệm này chỉ tồn
tại ở FE.

Cần BE xác nhận một trong hai:

1. Lịch một lần **không còn là nghiệp vụ hợp lệ** → FE gỡ hẳn công tắc khỏi form.
2. Vẫn hợp lệ nhưng biểu diễn bằng cách khác (ví dụ `validUntil = validFrom` +
   `daysOfWeek` đúng một ngày) → BE mô tả rõ cách biểu diễn để FE gửi cho đúng.

FE **không tự đoán** vì đây là luồng ghi, đoán sai thì tạo ra dữ liệu lịch sai.
Đang giữ nguyên hành vi cũ cho tới khi có trả lời.

## 3. Ghi chú tích hợp

**Strict-query đã đối chiếu tới source.** FE không dựa vào bảng trong tài liệu mà
đọc thẳng `[AllowedQueryParameters]` của 13 controller trong repo BE. Các type
tham số trong `src/api/vietride.ts` giờ khai tường minh đúng allow-list thay vì
mở rộng `PageParams` — nhờ vậy TypeScript chặn được tại chỗ biên dịch, không đợi
tới lúc chạy mới ăn 422. Hai chỗ đã bị bắt ngay khi siết type:

- `isOneTime` gửi lên `/v1/operator/driver-schedules`;
- `status` kiểu `string` gửi lên `/v1/operator/vehicles` (URL người dùng sửa tay
  được, nên FE lọc qua type-guard trước khi gửi).

**Hai type tách riêng cho bản admin.** `AdminTripSettlementParams` và
`AdminWalletTransactionParams` không còn kế thừa bản operator, vì bản operator có
`dateField` còn allow-list admin thì không.

**`/v1/rag/documents` dùng `q` chứ không phải `search`.** FE map tên ngay tại tầng
API nên BE không cần đổi. Nếu BE định chuẩn hoá về `search` thì báo trước để FE gỡ
đoạn map.

**Chưa test được với BE thật.** Toàn bộ thay đổi mới chỉ verify bằng unit test và
mock. Cần một lượt smoke test trên môi trường có BE mới trước khi lên production,
đặc biệt là:

- `/v1/admin/stations/summary` — endpoint mới, FE chưa từng gọi thật lần nào;
- `parentCode` của `/v1/admin/locations` — tài liệu nói mã không phải top-level sẽ
  trả `422` tại field `parentCode`; FE hiện hiển thị message lỗi chung, chưa map
  `error.fields[]` vào từng ô.
