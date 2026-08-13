# [FE → BE] Đề xuất bổ sung search/filter — rà soát toàn bộ màn danh sách

> Ngày: 2026-08-14
> Tiếp nối `BE_SEARCH_FILTER_GAP_2026-08-13.md` và `BE_SEARCH_FILTER_REMAINING_2026-08-13.md`
> Phạm vi: **tất cả** màn Admin + Manager có bảng dữ liệu, kể cả các màn đã gọi
> search/filter server-side đúng.
> FE không sửa source BE. Sau khi BE bổ sung, FE dựng UI tương ứng.

---

## 1. Cách đọc file này

Rà lại toàn bộ, kể cả màn đã làm xong ở đợt trước. Chia 4 nhóm:

| Nhóm | Nghĩa | Số mục |
|---|---|---|
| **P0** | Còn lọc/tìm ở client → dữ liệu hiển thị có thể sai | 2 |
| **P1** | Đã server-side nhưng thiếu filter mà người dùng thực sự cần | 10 |
| **P2** | Endpoint tổng hợp/đếm, để bỏ nốt kiểu tải-toàn-bộ | 3 |
| **P3** | BE **đã có sẵn**, FE chưa dựng UI → **BE không phải làm gì** | 5 |

Mỗi mục ghi rõ: endpoint, tham số đề nghị, kiểu, giá trị, **lý do nghiệp vụ**
(việc thật người dùng đang không làm được), và UI FE sẽ dựng sau.

Nguyên tắc FE giữ xuyên suốt: **không lọc nửa server nửa client**. Nếu một màn
có 4 bộ lọc mà BE chỉ nhận 3, FE giữ nguyên tải-toàn-bộ + lọc client cho tới khi
đủ cả 4 — vì lọc nửa vời chỉ áp trên trang đang xem, sai hơn hiện trạng.

---

## 2. P0 — Còn lọc/tìm ở client

Hai màn này là toàn bộ phần còn lại chưa chuyển được sau đợt trước.

### 2.1. `GET /v1/operator/vouchers` — thiếu `type`

Màn: Voucher nhà xe (`src/pages/Manager/Vouchers/index.tsx`)

Allow-list hiện tại: `isActive, search, service, page, pageSize, sortBy, sortDir`

Màn có **4** bộ lọc; BE mới đáp ứng 3. Thiếu bộ lọc loại giảm giá:

| Tham số | Kiểu | Giá trị |
|---|---|---|
| `type` | `string?` | `PERCENT_OFF` \| `FIXED_AMOUNT` |

Lý do: nhà xe hay rà riêng nhóm voucher giảm theo phần trăm khi tính lại ngân
sách khuyến mãi — giảm 20% và giảm 50.000đ có tác động chi phí rất khác nhau.

Kèm theo, đề nghị thêm luôn (cùng một lần đụng vào query cho gọn):

| Tham số | Kiểu | Lý do |
|---|---|---|
| `validAt` | `date?` | Lọc voucher **còn hiệu lực tại một mốc thời gian**. Hiện `isActive` chỉ là cờ bật/tắt, không phản ánh `validFrom`/`validUntil` — voucher đã hết hạn vẫn hiện là "đang bật". |
| `sortBy` | `string?` | `validUntil` \| `usedCount` \| `createdAt`. Sắp theo `validUntil` để thấy cái sắp hết hạn; theo `usedCount` để thấy cái nào thực sự có người dùng. |

FE sẽ dựng sau: giữ 4 dropdown hiện có, **thêm phân trang** (màn này đang chưa
có, đó là lý do FE chưa dám chuyển sang server-side — `pageSize=20` mặc định sẽ
âm thầm cắt mất voucher thứ 21).

### 2.2. `GET /v1/operator/parcel-route-fares` — thiếu `sortBy`/`sortDir`

Màn: Hàng hoá → tab bảng giá theo tuyến

Allow-list hiện tại: `routeId, sizeCategory, page, pageSize, search`

`search` đã dùng được. Còn thiếu sắp xếp theo giá — màn có sẵn dropdown
"giá tăng dần / giảm dần", sắp xếp mà chỉ áp trên trang hiện tại thì thứ tự sai.

| Tham số | Kiểu | Giá trị |
|---|---|---|
| `sortBy` | `string?` | `priceVnd` \| `effectiveFrom` |
| `sortDir` | `string?` | `asc` \| `desc` |

Đề nghị thêm, vì bảng giá có hiệu lực theo thời gian:

| Tham số | Kiểu | Lý do |
|---|---|---|
| `effectiveAt` | `date?` | Xem bảng giá **đang áp dụng tại một ngày**. Hiện màn trả cả giá cũ lẫn giá tương lai lẫn lộn, nhân viên báo giá cho khách phải tự đối chiếu `effectiveFrom`/`effectiveUntil` bằng mắt. |
| `status` | `string?` | `ACTIVE` \| `SCHEDULED` \| `EXPIRED` — FE đã tự suy ba trạng thái này ở client (`getRouteFareSummary`), đưa lên BE thì lọc được. |

Vướng thứ hai, **độc lập với sort** — xem §4.3.

---

## 3. P1 — Đã server-side nhưng thiếu filter người dùng cần

### 3.1. `GET /v1/operator/parcels` — thiếu ô tìm kiếm và khoảng thời gian ⚠️ ưu tiên cao nhất nhóm này

Màn: Hàng hoá → hàng đợi (`ParcelQueue.tsx`)

Allow-list hiện tại: `status, tripId, pendingActionType, page, pageSize`

**Ô tìm kiếm duy nhất của màn đang bắt người dùng nhập chính xác mã chuyến.**
Placeholder nguyên văn: *"Nhập chính xác mã chuyến để lọc..."*. Nghĩa là khi khách
gọi điện hỏi "đơn của tôi tới đâu rồi", nhân viên **không có cách nào** tra bằng
mã đơn, tên hay số điện thoại người gửi/người nhận — dù DTO trả về đủ cả
`parcelCode`, `senderName`, `senderPhone`, `recipientName`, `recipientPhone`.

Đây là màn nghiệp vụ dùng nhiều nhất trong ngày của nhân viên hàng hoá.

| Tham số | Kiểu | Ngữ nghĩa |
|---|---|---|
| `search` | `string?` | OR-match: `parcelCode`, `senderName`, `senderPhone`, `recipientName`, `recipientPhone`, `tripCode`. Unaccent + contains. |
| `from` / `to` | `date?` | Khoảng ngày tạo đơn. Không có thì không chốt được sổ theo ngày/tuần. |
| `dateField` | `string?` | `createdAt` \| `finalPaymentDeadline` \| `operatorActionDeadline`. Ba mốc này đều có trong DTO và đều là mốc điều hành thật. |
| `sizeCategory` | `string?` | Đã có ở endpoint bảng giá, thiếu ở đây. Dùng khi xếp hàng lên xe theo kích cỡ. |
| `routeId` | `string?` | Lọc theo tuyến, không phải theo từng chuyến. |
| `sortBy` / `sortDir` | `string?` | `createdAt` \| `operatorActionDeadline`. **Sắp theo hạn xử lý** là cái cần nhất: việc sắp trễ hạn phải nổi lên đầu. |

Gợi ý thêm, nếu không quá tốn: `overdueOnly: bool?` — chỉ lấy đơn đã quá
`operatorActionDeadline`. Hiện điều hành viên phải tự nhìn từng dòng.

FE sẽ dựng sau: thay ô "nhập mã chuyến" bằng ô tìm kiếm tổng quát, thêm bộ chọn
khoảng ngày, thêm sắp xếp theo hạn xử lý, giữ nguyên dropdown 23 trạng thái vừa bổ sung.

### 3.2. `GET /v1/operator/stations` — thiếu `isActive`, `supportsShuttle`

Màn: Bến nhà xe (`src/pages/Manager/Stations/index.tsx`)

Allow-list hiện tại: `page, pageSize, search`

Màn đang hiện **hai thẻ thống kê** "đang hoạt động" và "hỗ trợ trung chuyển" —
tức là dữ liệu có `isActive` và `supportsShuttle`, nhưng không lọc được theo
chúng. Bản admin `/v1/admin/stations` đã có cả hai; đề nghị đồng bộ.

| Tham số | Kiểu |
|---|---|
| `isActive` | `bool?` |
| `supportsShuttle` | `bool?` |
| `sortBy` / `sortDir` | `name` \| `createdAt` \| `updatedAt` |

### 3.3. `GET /v1/operator/stops` — thiếu `isActive`, `routeId`

Allow-list hiện tại: `page, pageSize, search`

| Tham số | Kiểu | Lý do |
|---|---|---|
| `isActive` | `bool?` | Đồng bộ với `/v1/admin/stops` (đã có) |
| `routeId` | `string?` | Xem điểm dừng thuộc một tuyến — hiện phải tải hết rồi tự đối chiếu |

### 3.4. `GET /v1/operator/driver-schedules` — thiếu lọc theo thứ và giờ chạy

Màn: Lịch chạy

Allow-list hiện tại: `page, pageSize, routeId, driverUserId, isActive, search, vehicleTypeId`

Đã khá đủ. Nhưng đây là **màn xếp lịch**, mà hai chiều xếp lịch quan trọng nhất
lại chưa lọc được:

| Tham số | Kiểu | Ngữ nghĩa |
|---|---|---|
| `dayOfWeek` | `int?` (1–7) | Lọc lịch chạy vào một thứ. "Chủ nhật có những chuyến nào" là câu hỏi hằng tuần. |
| `departureFrom` / `departureTo` | `time?` | Khoảng giờ khởi hành, ví dụ ca sáng 05:00–11:00. |
| `effectiveAt` | `date?` | Lịch **còn hiệu lực tại một ngày** — hiện `isActive` không xét `validFrom`/`validUntil`, lịch đã hết hạn vẫn hiện là đang bật. |
| `assistantUserId` | `string?` | Đã có `driverUserId`, thiếu phụ xe. |
| `sortBy` / `sortDir` | `string?` | `departureTime` \| `effectiveFrom`. |

### 3.5. `GET /v1/operator/incidents` — thiếu `search` và mức độ

Allow-list hiện tại: `tripId, category, status, from, to, page, pageSize`

| Tham số | Kiểu | Lý do |
|---|---|---|
| `search` | `string?` | Khớp `description`, tên người báo (`reporter.displayName`), mã chuyến. Hiện muốn tìm một sự cố cụ thể phải lật từng trang. |
| `reportedByUserId` | `string?` | Xem sự cố do một tài xế báo — hữu ích khi đánh giá nhân sự. |
| `sortBy` / `sortDir` | `string?` | `reportedAt` \| `resolvedAt`. |

### 3.6. `GET /v1/operator/routes` — thiếu sắp xếp và lọc theo bến

Allow-list hiện tại: `page, pageSize, search, isActive`

| Tham số | Kiểu | Lý do |
|---|---|---|
| `originStationId` / `destinationStationId` | `string?` | "Từ bến này đi được những đâu" — câu hỏi cơ bản khi dựng tuyến mới, hiện không trả lời được. |
| `sortBy` / `sortDir` | `string?` | `name` \| `totalDistanceKm` \| `estimatedDurationMinutes`. Màn đã hiện cả ba cột này nhưng không sắp xếp được cột nào. |

### 3.7. `GET /v1/operator/shuttle-requests` — chưa có bất kỳ filter nào

Màn: Điều phối xe trung chuyển

Allow-list hiện tại: `page, pageSize` — chỉ có vậy.

Đây là hàng đợi điều phối theo thời gian thực mà không lọc được gì:

| Tham số | Kiểu | Ngữ nghĩa |
|---|---|---|
| `status` | `string?` | Trạng thái yêu cầu (chờ gán / đã gán / đã huỷ) |
| `from` / `to` | `date?` | Khoảng thời gian yêu cầu (`requestedAt`) |
| `mainTripId` | `string?` | Yêu cầu thuộc một chuyến chính |
| `search` | `string?` | Địa chỉ đón (`pickupAddress`), tên/SĐT khách |
| `unassignedOnly` | `bool?` | Chỉ yêu cầu chưa gán xe — chính là việc điều phối viên cần làm |

### 3.8. `GET /v1/admin/operators` — thiếu `isActive` và khoảng ngày

Allow-list hiện tại: `page, pageSize, search, sortBy, sortDir, status`

`status` là `registrationStatus` (PENDING/APPROVED/…). Nhưng DTO còn có `isActive`
**riêng biệt** — nhà xe đã duyệt vẫn có thể bị tắt. Hai khái niệm này đang bị gộp
làm một trên UI.

| Tham số | Kiểu | Lý do |
|---|---|---|
| `isActive` | `bool?` | Tách khỏi `registrationStatus`, giống cách `/v1/operator/vehicles` tách `status` với `isActive` |
| `from` / `to` + `dateField` | `date?` | `createdAt` \| `approvedAt`. Báo cáo "tháng này duyệt bao nhiêu nhà xe" hiện phải đếm tay. |

### 3.9. `GET /v1/admin/users` — thiếu khoảng ngày

Allow-list hiện tại: `search, role, status, operatorId, includeDeleted, page, pageSize, sortBy, sortDir`

Khá đầy đủ. Chỉ thiếu:

| Tham số | Kiểu | Lý do |
|---|---|---|
| `from` / `to` | `date?` | Khoảng `createdAt`. Xem người dùng đăng ký trong một kỳ. |

### 3.10. `GET /v1/operator/invoices` — thiếu tìm kiếm

Allow-list hiện tại: `page, pageSize, status, from, to, sortBy, sortDir`

| Tham số | Kiểu |
|---|---|
| `search` | `string?` — khớp mã hoá đơn / mã tham chiếu |

---

## 4. P2 — Endpoint tổng hợp, để bỏ nốt kiểu tải-toàn-bộ

Ba chỗ FE còn phải tải nhiều trang chỉ để **đếm**, không phải để lọc.

### 4.1. `GET /v1/admin/operators/summary`

Màn Admin → Nhà xe có 3 thẻ đếm theo `registrationStatus` (chờ duyệt / đã duyệt /
bị hạn chế) và nút xuất CSV toàn bộ kết quả khớp. Vì vậy FE vẫn phải
`fetchAllPages`, dù search/status đã server-side.

```json
{ "total": 0, "pending": 0, "approved": 0, "suspended": 0, "rejected": 0, "active": 0 }
```

Nếu có thêm `GET /v1/admin/operators/export` (CSV, nhận cùng bộ filter) thì FE bỏ
được hẳn `fetchAllPages` ở màn này.

### 4.2. `GET /v1/admin/vouchers/summary`

Hiện FE đếm 3 thẻ bằng **3 request `pageSize=1`** (`isActive=true`,
`service=BOOKING`, `service=PARCEL`) chỉ để lấy `totalItems`. Chạy được nhưng tốn
3 vòng request mỗi lần vào màn.

```json
{ "total": 0, "active": 0, "booking": 0, "parcel": 0, "expiringIn7Days": 0 }
```

`expiringIn7Days` là thứ màn đang thiếu hẳn — voucher sắp hết hạn không có cảnh báo nào.

Tương tự đề nghị `GET /v1/operator/vouchers/summary` cho bản nhà xe.

### 4.3. Bảng giá hàng hoá — tóm tắt theo tuyến

Modal tạo/sửa giá hiển thị **tóm tắt giá đã cấu hình của từng tuyến**
(`getRouteFareSummary`). Cái đó cần biết toàn bộ fare, không suy được từ một trang
— đây là lý do còn lại khiến §2.2 chưa chuyển được kể cả khi đã có sort.

Hai hướng, chọn một:

- `GET /v1/operator/parcel-route-fares/summary` → `[{ routeId, configuredSizeCategories, hasActiveWindow, hasScheduledWindow }]`
- hoặc `GET /v1/operator/routes` trả kèm cờ `hasParcelFare: bool`

### 4.4. Thống kê no-show của đặt vé

Màn Đặt vé đang `fetchAllPages` toàn bộ booking `status=NO_SHOW` chỉ để **cộng số
hành khách**. Đề nghị đưa vào `/v1/operator/booking-stats` (đã tồn tại) một trường
`noShowPassengerCount`, FE bỏ được vòng tải đó.

---

## 5. P3 — BE đã có sẵn, FE chưa dựng UI (BE không phải làm gì)

Ghi lại để hai bên khỏi làm trùng. **FE làm được ngay, không chờ BE.**

| Endpoint | Tham số BE đã có mà FE chưa dùng | Màn |
|---|---|---|
| `/v1/rag/documents` | `status`, `ingestStatus`, `accessLevel`, `category`, `documentType`, `operatorId` | Admin → RAG Audit. Màn chỉ có ô tìm kiếm, **6 bộ lọc bỏ không**. Bảng đang hiện cột trạng thái và cấp truy cập mà không lọc được. |
| `/v1/admin/policies` | `search`, `category`, `active`, `sortBy`, `sortDir` | Admin → Chính sách. Mới gửi mỗi `policyType`. |
| `/v1/admin/users` | `operatorId` | Admin → Người dùng. Lọc nhân sự theo nhà xe. |
| `/v1/operator/driver-schedules` | `routeId`, `driverUserId` | Lịch chạy. UI mới có ô tìm kiếm + trạng thái + loại xe. |
| `/v1/operator/users` | `sortBy`, `sortDir` | Nhân sự. |
| `/v1/operator/trips` | `search`, `status`, `from`, `to`, `sortBy`, `sortDir` | **Chưa có màn nào dùng.** Endpoint đầy đủ nhưng Manager không có màn danh sách chuyến — hiện chỉ Dashboard và Trung tâm vận hành gọi, không có UI lọc. Có thể là một màn còn thiếu. |

---

## 6. Chuẩn hoá xuyên suốt

Ba điểm này không phải lỗi, nhưng làm sớm thì đỡ nợ về sau.

**6.1. Tên tham số đang lệch nhau giữa các service.**

| Ngữ nghĩa | Tên đang dùng |
|---|---|
| Từ khoá | `search` (hầu hết) · `q` (`/v1/rag/documents`) |
| Bật/tắt | `isActive` (trip) · `active` (rag) · `status` (identity, booking) |

Đề nghị chốt `search` và `isActive`. FE hiện đang map `q` ngay tại tầng API để
che khác biệt này — nếu BE chuẩn hoá, báo trước để FE gỡ.

**6.2. Khoảng thời gian nên đi kèm `dateField`.**

`/v1/operator/wallet/transactions`, `/trip-settlements`, `/ledger` đã làm đúng:
`from` + `to` + `dateField`. Các endpoint khác chỉ có `from`/`to` và ngầm hiểu là
`createdAt`. Với những bảng có nhiều mốc thời gian (bưu kiện có 3 mốc, đối soát có
4), thiếu `dateField` là lọc sai ý.

**6.3. `sortBy`/`sortDir` nên có ở mọi list.**

Hiện chỉ khoảng một nửa endpoint có. Bảng nào hiện cột số (giá, khoảng cách, thời
gian, số lượt dùng) mà không sắp xếp được thì cột đó gần như chỉ để nhìn.

**6.4. Cảnh báo cũ vẫn giữ nguyên giá trị:** endpoint .NET bind `[FromQuery]` bỏ
qua tham số lạ mà không báo lỗi. Đợt vừa rồi đã bật `[AllowedQueryParameters]` cho
13 endpoint — đề nghị áp cho **mọi** GET list, kể cả những cái chưa đụng tới, để
lệch hợp đồng lộ ra ngay từ lần gọi đầu thay vì âm thầm trả dữ liệu chưa lọc.

---

## 7. Bảng tổng hợp để ước lượng

| # | Endpoint | Tham số thêm | Ưu tiên |
|---|---|---|---|
| 2.1 | `/v1/operator/vouchers` | `type`, `validAt`, `sortBy` | P0 |
| 2.2 | `/v1/operator/parcel-route-fares` | `sortBy`, `sortDir`, `effectiveAt`, `status` | P0 |
| 3.1 | `/v1/operator/parcels` | `search`, `from`, `to`, `dateField`, `sizeCategory`, `routeId`, `sortBy`, `sortDir`, `overdueOnly` | **P1 cao** |
| 3.2 | `/v1/operator/stations` | `isActive`, `supportsShuttle`, `sortBy`, `sortDir` | P1 |
| 3.3 | `/v1/operator/stops` | `isActive`, `routeId` | P1 |
| 3.4 | `/v1/operator/driver-schedules` | `dayOfWeek`, `departureFrom`, `departureTo`, `effectiveAt`, `assistantUserId`, `sortBy`, `sortDir` | P1 |
| 3.5 | `/v1/operator/incidents` | `search`, `reportedByUserId`, `sortBy`, `sortDir` | P1 |
| 3.6 | `/v1/operator/routes` | `originStationId`, `destinationStationId`, `sortBy`, `sortDir` | P1 |
| 3.7 | `/v1/operator/shuttle-requests` | `status`, `from`, `to`, `mainTripId`, `search`, `unassignedOnly` | P1 |
| 3.8 | `/v1/admin/operators` | `isActive`, `from`, `to`, `dateField` | P1 |
| 3.9 | `/v1/admin/users` | `from`, `to` | P1 |
| 3.10 | `/v1/operator/invoices` | `search` | P1 |
| 4.1 | `/v1/admin/operators/summary` (+ `/export`) | endpoint mới | P2 |
| 4.2 | `/v1/admin/vouchers/summary`, `/v1/operator/vouchers/summary` | endpoint mới | P2 |
| 4.3 | tóm tắt fare theo tuyến | endpoint mới **hoặc** cờ trên `/v1/operator/routes` | P2 |
| 4.4 | `/v1/operator/booking-stats` | thêm `noShowPassengerCount` | P2 |

---

## 8. FE cam kết làm gì

**Ngay, không chờ BE** — toàn bộ nhóm P3 ở §5: dựng UI lọc cho RAG Audit
(6 bộ lọc), Chính sách (tìm kiếm + nhóm + trạng thái), lọc theo nhà xe ở màn Người
dùng, lọc theo tuyến/tài xế ở màn Lịch chạy, sắp xếp ở màn Nhân sự.

**Sau khi BE bổ sung** — theo thứ tự P0 → P1 → P2:

- §2.1 xong: chuyển Voucher nhà xe sang server-side **và thêm phân trang**.
- §2.2 + §4.3 xong: bỏ `fetchAllPages` ở tab bảng giá hàng hoá.
- §3.1 xong: thay ô "nhập mã chuyến" bằng tìm kiếm tổng quát + khoảng ngày +
  sắp xếp theo hạn xử lý. Đây là thay đổi FE đánh giá **có tác động lớn nhất tới
  công việc hằng ngày** trong cả danh sách này.
- §4.1 xong: bỏ `fetchAllPages` cuối cùng ở màn Nhà xe.

Sau khi làm hết, **không còn màn nào lọc/tìm ở client** ngoài hai chỗ cố ý:
bản đồ Trung tâm vận hành (dữ liệu realtime dựng trong bộ nhớ, không phân trang)
và các ô chọn bến/điểm dừng trong luồng tạo tuyến (picker, không phải bảng).

## 9. Lưu ý kiểm thử

Các thay đổi FE ba đợt vừa rồi mới chỉ verify bằng unit test và mock — **chưa
chạy thật với BE mới lần nào**. Cần một lượt smoke test trên môi trường có BE mới
trước khi lên production, đặc biệt `/v1/admin/stations/summary` (endpoint mới, FE
chưa gọi thật) và `parentCode` của `/v1/admin/locations` (BE trả 422 tại field khi
mã không phải top-level; FE hiện mới hiện message lỗi chung, chưa map
`error.fields[]` vào từng ô).
