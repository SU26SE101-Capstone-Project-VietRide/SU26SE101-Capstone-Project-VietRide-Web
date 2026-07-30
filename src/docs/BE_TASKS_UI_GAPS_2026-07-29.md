# BE backlog từ đối chiếu UI VietRide

Ngày rà soát: **2026-07-29**

Trạng thái: **Đề xuất contract để BE triển khai**

Phạm vi:

- `SYSTEM_ADMIN`
- `OPERATOR_ADMIN`
- Các thiếu hụt được ghi trong `Hỗ trợ.txt`
- UI và API client hiện có trong codebase FE

Không thuộc phạm vi tài liệu này:

- Sửa FE.
- Đổi các endpoint đã chạy ổn nếu chỉ cần bổ sung field.
- Các role Passenger, Driver, Assistant, trừ internal lookup cần thiết để dựng
  response cho hai role trong phạm vi.

## 1. Nguồn đối chiếu

Các màn hình/contract FE chính:

- `src/pages/Admin/Dashboard.tsx`
- `src/pages/Admin/Policies.tsx`
- `src/pages/Admin/Operators.tsx`
- `src/pages/Admin/WalletSettlement/index.tsx`
- `src/pages/Admin/Revenue.tsx`
- `src/pages/Admin/Reports.tsx`
- `src/pages/Admin/Stations/index.tsx`
- `src/pages/Manager/Dashboard.tsx`
- `src/pages/Manager/Trips/TripOperationsPanel.tsx`
- `src/pages/Manager/Parcels/index.tsx`
- `src/pages/Manager/Bookings/index.tsx`
- `src/pages/Manager/Policies/index.tsx`
- `src/pages/Manager/Reports/index.tsx`
- `src/api/vietride.ts`
- `src/docs/frontend-api-coverage.md`

Kết luận nhanh:

| Nhóm                     | Hiện trạng FE                                                           | BE cần làm                                                                         |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Admin Dashboard          | Một phần dùng `/v1/admin/booking-stats/aggregate`, phần còn lại là mock | Bổ sung summary, phân bố user/operator và hoàn thiện aggregate theo tháng/operator |
| Policy                   | Cả Admin và Operator đều dùng mock state                                | CRUD thật, phân quyền và tenant scope                                              |
| Nhà xe                   | Đã gọi API thật nhưng response thiếu dữ liệu hiển thị                   | Mở rộng DTO, không tạo endpoint trùng                                              |
| Ví và đối soát           | API thật, DTO thiếu thông tin nhà xe/actor                              | Mở rộng DTO                                                                        |
| Admin Revenue            | Toàn bộ là mock                                                         | API analytics theo tháng và top 5 nhà xe                                           |
| Admin Reports            | Contract FE đã có, runtime đang lỗi upstream                            | Sửa orchestration/internal auth/routing/timeout                                    |
| Operator Dashboard       | Booking stats một phần thật; parcel chart là mock                       | Hoàn thiện booking group theo tháng và parcel aggregate                            |
| Tìm chuyến để thay xe    | Mutation thay xe đã có; chưa có API tìm chuyến                          | Thêm `GET /v1/operator/trips`                                                      |
| Hàng hóa                 | Giá theo từng size; list/detail thiếu projection                        | Batch upsert giá và mở rộng parcel DTO                                             |
| Booking                  | List/detail thiếu thông tin người đặt                                   | Bổ sung buyer projection                                                           |
| Operator Revenue/Reports | Export thật; KPI/chart là mock                                          | API revenue analytics                                                              |
| Admin Stations           | GET/PATCH/merge đã có                                                   | Không tạo task mới trong backlog này                                               |

## 2. Quy ước contract chung

### 2.1 Base URL, auth và tenant

- Public API: `/v1/**` qua Gateway.
- `SYSTEM_ADMIN`: Bearer token có role `SYSTEM_ADMIN`.
- `OPERATOR_ADMIN`: Bearer token có role `OPERATOR_ADMIN`.
- Với `/v1/operator/**`, `operatorId` luôn lấy từ JWT claim. Không nhận
  `operatorId` từ query/body để tránh đọc chéo tenant.
- Internal API dùng `X-Internal-Auth: <internal-jwt>`, không forward Bearer token
  của người dùng.

### 2.2 Response envelope

Public API tiếp tục dùng ADR 0004:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-...",
    "timestamp": "2026-07-29T10:30:00Z"
  }
}
```

Paged response trong `data`:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0,
  "hasPreviousPage": false,
  "hasNextPage": false
}
```

### 2.3 Kiểu dữ liệu

- Tiền: integer VND, hậu tố field `Vnd`; không trả chuỗi đã format.
- Thời gian: ISO 8601 có timezone.
- Ngày: `YYYY-MM-DD`.
- Tỷ lệ: number, đơn vị phần trăm, ví dụ `12.5`.
- Khi kỳ trước bằng `0`, `changePercent` trả `null`, không trả `Infinity`.
- Mutation tạo/sửa/xóa/batch/settle dùng `Idempotency-Key`.

Mẫu so sánh kỳ:

```json
{
  "currentValue": 120000000,
  "previousValue": 100000000,
  "changePercent": 20,
  "trend": "UP"
}
```

`trend`: `UP | DOWN | FLAT | NEW`.

---

## 3. Danh sách task ưu tiên

| ID          | Ưu tiên | Task                                                        |
| ----------- | ------: | ----------------------------------------------------------- |
| `BE-ADM-01` |      P0 | Hoàn thiện API Admin Dashboard                              |
| `BE-POL-01` |      P0 | CRUD Policy cho System Admin và Operator Admin              |
| `BE-ADM-02` |      P0 | Bổ sung thông tin chi tiết Nhà xe                           |
| `BE-FIN-01` |      P0 | Bổ sung operator/actor cho settlement và wallet transaction |
| `BE-ADM-03` |      P1 | API Admin Revenue analytics                                 |
| `BE-ADM-04` |      P0 | Sửa lỗi `GET /v1/admin/reports/platform`                    |
| `BE-OP-01`  |      P1 | Hoàn thiện API Operator Dashboard                           |
| `BE-OP-02`  |      P0 | API tìm kiếm chuyến để thay xe                              |
| `BE-OP-03`  |      P0 | Batch giá hàng hóa và enrich Parcel DTO                     |
| `BE-OP-04`  |      P0 | Bổ sung thông tin người đặt Booking                         |
| `BE-OP-05`  |      P1 | API Operator Revenue analytics                              |

---

## 4. Chi tiết task SYSTEM_ADMIN

## BE-ADM-01 — Hoàn thiện API Admin Dashboard

### Mục tiêu

Loại bỏ các số mock tại `Admin/Dashboard.tsx`:

- Tổng doanh thu.
- Nhà xe hoạt động.
- Người dùng hoạt động.
- Booking trong kỳ.
- Doanh thu và booking theo tháng.
- Phân bố người dùng theo role.
- Doanh thu theo nhà xe.
- Trạng thái nhà xe.

### 4.1 Dashboard summary

```http
GET /v1/admin/dashboard/summary?from=2026-01-01&to=2026-12-31
Authorization: Bearer <SYSTEM_ADMIN>
```

Response `data`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-12-31",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "totalRevenue": {
    "currentValue": 45800000000,
    "previousValue": 36790000000,
    "changePercent": 24.5,
    "trend": "UP"
  },
  "activeOperators": {
    "currentValue": 342,
    "previousValue": 290,
    "changePercent": 17.93,
    "trend": "UP"
  },
  "activeUsers": {
    "currentValue": 182500,
    "previousValue": 149000,
    "changePercent": 22.48,
    "trend": "UP"
  },
  "bookings": {
    "currentValue": 245600,
    "previousValue": 211200,
    "changePercent": 16.29,
    "trend": "UP"
  },
  "userDistribution": [
    { "role": "PASSENGER", "count": 165000 },
    { "role": "DRIVER", "count": 8500 },
    { "role": "OPERATOR_ADMIN", "count": 342 },
    { "role": "SYSTEM_ADMIN", "count": 12 }
  ],
  "operatorStatusDistribution": [
    { "status": "APPROVED", "count": 285, "percent": 83.33 },
    { "status": "PENDING", "count": 28, "percent": 8.19 },
    { "status": "SUSPENDED", "count": 19, "percent": 5.56 },
    { "status": "REJECTED", "count": 10, "percent": 2.92 }
  ]
}
```

Quy ước:

- `activeOperators`: nhà xe `APPROVED` và `isActive=true`.
- `activeUsers`: user không bị soft-delete/lock; BE phải thống nhất điều kiện
  active với Identity Service.
- Kỳ so sánh trước có cùng số ngày ngay trước `from`.

### 4.2 Mở rộng aggregate Booking hiện có

Giữ endpoint:

```http
GET /v1/admin/booking-stats/aggregate
  ?from=2026-01-01
  &to=2026-12-31
  &groupBy=month
```

Hỗ trợ tối thiểu:

- `groupBy=month`
- `groupBy=operator`

Item theo tháng:

```json
{
  "date": "2026-01-01",
  "totalBookings": 15200,
  "totalRevenue": 2400000000,
  "totalCancellations": 1850
}
```

Item theo operator:

```json
{
  "operatorId": "uuid",
  "operatorName": "FUTA Bus Lines",
  "totalBookings": 3240,
  "totalRevenue": 12500000000,
  "totalCancellations": 120
}
```

### Acceptance criteria

- Không còn hard-code KPI/chart ở FE sau khi tích hợp.
- Khoảng thời gian hợp lệ và `from <= to`.
- Các tháng không có dữ liệu vẫn trả item giá trị `0` để chart không bị đứt.
- Tổng ở summary khớp tổng các item cùng điều kiện lọc.
- Không N+1 khi lấy tên operator.
- Có unit test cho công thức kỳ trước và integration test cho cả hai `groupBy`.

---

## BE-POL-01 — CRUD Policy

Hai UI Policy hiện chỉ sửa mảng mock. Cần một resource chung ở domain layer nhưng
expose hai route theo RBAC/tenant.

### 4.3 Policy của nền tảng

| Method | Endpoint                  | Role           | Mục đích          |
| ------ | ------------------------- | -------------- | ----------------- |
| GET    | `/v1/admin/policies`      | `SYSTEM_ADMIN` | List/filter/page  |
| GET    | `/v1/admin/policies/{id}` | `SYSTEM_ADMIN` | Chi tiết          |
| POST   | `/v1/admin/policies`      | `SYSTEM_ADMIN` | Tạo               |
| PATCH  | `/v1/admin/policies/{id}` | `SYSTEM_ADMIN` | Sửa/toggle active |
| DELETE | `/v1/admin/policies/{id}` | `SYSTEM_ADMIN` | Soft delete       |

List query:

- `policyType=FOR_OPERATOR|FOR_USER`
- `category`
- `active`
- `search`
- `page`, `pageSize`
- `sortBy=updatedAt|createdAt|title|version`
- `sortDir=asc|desc`

Create body:

```json
{
  "title": "Chính sách hoàn vé",
  "description": "Quy định hoàn vé áp dụng toàn hệ thống",
  "content": "Nội dung Markdown hoặc plain text",
  "policyType": "FOR_OPERATOR",
  "category": "REFUND",
  "active": true
}
```

Policy DTO:

```json
{
  "id": "uuid",
  "title": "Chính sách hoàn vé",
  "description": "Quy định hoàn vé áp dụng toàn hệ thống",
  "content": "Nội dung...",
  "policyType": "FOR_OPERATOR",
  "category": "REFUND",
  "version": 1,
  "active": true,
  "createdBy": {
    "userId": "uuid",
    "displayName": "System Admin",
    "email": "admin@vietride.vn"
  },
  "createdAt": "2026-07-29T10:00:00Z",
  "updatedAt": "2026-07-29T10:00:00Z"
}
```

### 4.4 Policy riêng của nhà xe

| Method | Endpoint                     | Role             | Mục đích               |
| ------ | ---------------------------- | ---------------- | ---------------------- |
| GET    | `/v1/operator/policies`      | `OPERATOR_ADMIN` | List policy của tenant |
| GET    | `/v1/operator/policies/{id}` | `OPERATOR_ADMIN` | Chi tiết               |
| POST   | `/v1/operator/policies`      | `OPERATOR_ADMIN` | Tạo                    |
| PATCH  | `/v1/operator/policies/{id}` | `OPERATOR_ADMIN` | Sửa/toggle active      |
| DELETE | `/v1/operator/policies/{id}` | `OPERATOR_ADMIN` | Soft delete            |

Request không nhận `operatorId`. Response bổ sung:

```json
{
  "operatorId": "operator-uuid"
}
```

### Business rules

- `title`, `description`, `content`, `category` là bắt buộc sau khi trim.
- `version` do server quản lý, bắt đầu từ `1`.
- Sửa title/description/content/category tăng `version` đúng một lần.
- Chỉ toggle `active` không tăng version nội dung.
- Delete là soft delete để giữ lịch sử/audit.
- Operator chỉ đọc/sửa/xóa policy thuộc operator trong JWT.
- Mọi mutation ghi actor, thời gian và audit log.

### Error contract

- `404 POLICY_NOT_FOUND`
- `403 FORBIDDEN`
- `409 POLICY_VERSION_CONFLICT` nếu dùng optimistic concurrency
- `422 VALIDATION_ERROR`

### Acceptance criteria

- CRUD đầy đủ cho cả hai route.
- Không thể truy cập policy của operator khác bằng cách đổi path id.
- List có pagination chuẩn.
- Có test RBAC, tenant isolation, version increment, soft delete và idempotency.

---

## BE-ADM-02 — Bổ sung thông tin Nhà xe

Giữ endpoint hiện có:

```http
GET /v1/admin/operators
```

Mỗi item phải trả đầy đủ các field UI modal đang dùng:

```json
{
  "operatorId": "uuid",
  "name": "FUTA Bus Lines",
  "contactEmail": "contact@futa.vn",
  "contactPhone": "19006067",
  "businessRegistrationNumber": "BRN-001",
  "taxCode": "0300000001",
  "logoUrl": "https://...",
  "address": {
    "street": "272 Đề Thám",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "province": "TP. Hồ Chí Minh"
  },
  "representativeName": "Nguyễn Văn A",
  "representativePhone": "0900000000",
  "registrationStatus": "APPROVED",
  "isActive": true,
  "createdAt": "2026-01-10T08:00:00Z",
  "approvedAt": "2026-01-11T08:00:00Z"
}
```

Yêu cầu tương thích:

- Đây là additive change; không đổi tên/xóa field cũ trong cùng release.
- Field chưa có dữ liệu trả `null`, không bỏ key tùy từng record.
- `logoUrl` phải là URL client có thể tải được; nếu signed URL thì TTL đủ cho
  một phiên quản trị.
- Search/status/page hiện có tiếp tục hoạt động.

### Acceptance criteria

- List và filter không làm mất các projection bổ sung.
- Không phát sinh N+1 Identity/Operator lookup.
- Contract test xác nhận đủ address, representative và logo.

---

## BE-FIN-01 — Enrich settlement và wallet transaction

### 4.5 Trip settlement

Giữ endpoint:

```http
GET /v1/admin/trip-settlements
```

Mỗi item bổ sung `operator`:

```json
{
  "settlementId": "uuid",
  "tripId": "uuid",
  "operatorId": "uuid",
  "operator": {
    "operatorId": "uuid",
    "name": "FUTA Bus Lines",
    "logoUrl": "https://...",
    "contactPhone": "19006067"
  },
  "status": "ELIGIBLE",
  "netAmount": 12000000,
  "eligibleAt": "2026-07-29T00:00:00Z",
  "settlementMethod": null,
  "settledAt": null,
  "settledBy": null,
  "createdAt": "2026-07-22T00:00:00Z"
}
```

Khi settlement thủ công:

```json
{
  "settledBy": {
    "userId": "uuid",
    "displayName": "System Admin",
    "email": "admin@vietride.vn",
    "role": "SYSTEM_ADMIN"
  }
}
```

Settlement tự động có `settledBy=null`.

### 4.6 Platform wallet transaction

Giữ endpoint:

```http
GET /v1/admin/platform-wallet/transactions
```

Mỗi item bổ sung:

```json
{
  "actorType": "USER",
  "actor": {
    "userId": "uuid",
    "displayName": "System Admin",
    "email": "admin@vietride.vn",
    "role": "SYSTEM_ADMIN"
  }
}
```

Giao dịch do job/event tạo:

```json
{
  "actorType": "SYSTEM",
  "actor": null
}
```

### Acceptance criteria

- Filter/pagination cũ không đổi.
- Actor được snapshot hoặc resolve ổn định kể cả user đã bị khóa/soft-delete.
- Không lấy actor từ body do client gửi; actor lấy từ authenticated context.
- Batch lookup operator/user, không N+1.
- Test được manual settlement, automatic settlement, user actor và system actor.

---

## BE-ADM-03 — Admin Revenue analytics

```http
GET /v1/admin/revenue/analytics
  ?from=2026-01-01
  &to=2026-12-31
  &groupBy=month
  &top=5
Authorization: Bearer <SYSTEM_ADMIN>
```

Response `data`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-12-31",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "summary": {
    "grossRevenueVnd": {
      "currentValue": 354000000000,
      "previousValue": 312200000000,
      "changePercent": 13.39,
      "trend": "UP"
    },
    "platformRevenueVnd": {
      "currentValue": 28300000000,
      "previousValue": 25310000000,
      "changePercent": 11.81,
      "trend": "UP"
    },
    "paidToOperatorsVnd": {
      "currentValue": 325600000000,
      "previousValue": 286300000000,
      "changePercent": 13.73,
      "trend": "UP"
    }
  },
  "monthly": [
    {
      "month": "2026-01",
      "grossRevenueVnd": 9600000000,
      "paidToOperatorsVnd": 9000000000,
      "platformRevenueVnd": 600000000
    }
  ],
  "topOperators": [
    {
      "rank": 1,
      "operatorId": "uuid",
      "operatorName": "FUTA Bus Lines",
      "logoUrl": "https://...",
      "revenueVnd": 11200000000,
      "vehicleCount": 392
    }
  ]
}
```

Định nghĩa bắt buộc:

```text
grossRevenueVnd = paidToOperatorsVnd + platformRevenueVnd
```

BE phải dùng ledger/settlement source of truth đã thống nhất, không cộng trực tiếp
các trạng thái thanh toán chưa hoàn tất.

### Acceptance criteria

- `top` clamp `1..20`, mặc định `5`.
- Tháng không có dữ liệu trả `0`.
- Tổng monthly khớp summary trong cùng phạm vi và cùng timezone.
- Có test boundary đầu/cuối tháng và giao dịch refund/reversal.

---

## BE-ADM-04 — Sửa `GET /v1/admin/reports/platform`

Contract public đã được FE sử dụng:

```http
GET /v1/admin/reports/platform
  ?from=2026-07-01T00:00:00.000Z
  &to=2026-08-01T00:00:00.000Z
Authorization: Bearer <SYSTEM_ADMIN>
```

Lưu ý `to` là exclusive. UI chấp nhận tối đa 366 ngày.

Response `data`:

```json
{
  "period": {
    "from": "2026-07-01T00:00:00Z",
    "to": "2026-08-01T00:00:00Z",
    "timezone": "UTC"
  },
  "totals": {
    "completedBookingCount": 100,
    "completedTripCount": 20,
    "deliveredParcelCount": 50,
    "bookingRevenueVnd": 120000000,
    "parcelRevenueVnd": 30000000,
    "netRevenueVnd": 150000000
  },
  "byOperator": [
    {
      "operatorId": "uuid",
      "operatorName": "FUTA Bus Lines",
      "completedBookingCount": 40,
      "completedTripCount": 8,
      "deliveredParcelCount": 20,
      "bookingRevenueVnd": 48000000,
      "parcelRevenueVnd": 12000000,
      "netRevenueVnd": 60000000
    }
  ],
  "generatedAt": "2026-07-29T10:30:00Z"
}
```

### Checklist điều tra bắt buộc

Kiểm tra đủ bốn nguồn nội bộ:

```text
/internal/v1/reports/platform/bookings
/internal/v1/reports/platform/trips
/internal/v1/reports/platform/parcels
/internal/v1/operators/summaries/batch
```

Đồng thời kiểm tra:

1. Gateway route public `/v1/admin/reports/platform`.
2. Internal JWT: issuer, audience, expiry, clock skew và header
   `X-Internal-Auth`.
3. Service discovery/base URL theo từng môi trường.
4. Timeout 5 giây của Payment Service và mapping lỗi timeout.
5. Trace propagation từ Gateway đến tất cả downstream.
6. Batch operator summaries không bị gọi N lần.

### Error contract

Không trả raw exception/HTML. Upstream timeout/unavailable trả:

```json
{
  "success": false,
  "statusCode": 502,
  "error": {
    "code": "PLATFORM_REPORT_SOURCE_UNAVAILABLE",
    "message": "Platform report source is temporarily unavailable.",
    "details": {
      "source": "PAYMENT"
    }
  },
  "meta": {
    "traceId": "req-...",
    "timestamp": "2026-07-29T10:30:00Z"
  }
}
```

Không đưa internal URL, token hoặc stack trace vào response.

### Acceptance criteria

- Happy path trả `200` đúng DTO ở trên.
- `from >= to` hoặc range > 366 ngày trả `422 VALIDATION_ERROR`.
- Mỗi upstream có integration test success, unauthorized, timeout và malformed
  payload.
- Timeout được map thành `502 PLATFORM_REPORT_SOURCE_UNAVAILABLE`, không thành
  generic `500`.
- Log có `traceId`, source lỗi và elapsed time; không log internal JWT.
- Tổng `byOperator` khớp `totals` theo rule aggregation đã thống nhất.

---

## 5. Chi tiết task OPERATOR_ADMIN

## BE-OP-01 — Hoàn thiện Operator Dashboard

### 5.1 Booking revenue theo tháng

Mở rộng endpoint hiện có:

```http
GET /v1/operator/booking-stats
  ?from=2026-01-01
  &to=2026-12-31
  &groupBy=month
```

Response:

```json
{
  "items": [
    {
      "date": "2026-01-01",
      "totalBookings": 320,
      "totalRevenue": 180000000,
      "totalCancellations": 12,
      "totalCompleted": 290
    }
  ],
  "totalBookings": 1284,
  "totalRevenue": 2284500000
}
```

Giữ `groupBy=date` để tương thích UI Booking hiện tại.

### 5.2 Parcel aggregate cho dashboard

```http
GET /v1/operator/parcel-stats
  ?from=2026-07-01
  &to=2026-07-31
  &groupBy=status
```

Response theo status:

```json
{
  "items": [
    { "key": "IN_TRANSIT", "count": 45 },
    { "key": "DELIVERED", "count": 35 },
    { "key": "WAITING_DELIVERY", "count": 15 },
    { "key": "POSTPONED", "count": 5 }
  ],
  "totalParcels": 100
}
```

Response theo route:

```http
GET /v1/operator/parcel-stats
  ?from=2026-07-01
  &to=2026-07-31
  &groupBy=route
  &limit=10
```

```json
{
  "items": [
    {
      "routeId": "uuid",
      "routeName": "HCM - Đà Lạt",
      "parcelCount": 245
    }
  ],
  "totalParcels": 845
}
```

### Acceptance criteria

- Scope theo operator trong JWT.
- `groupBy` ngoài allow-list trả `422`.
- Month/date bucket theo `Asia/Ho_Chi_Minh`.
- Route đã inactive vẫn hiện đúng tên snapshot hoặc tên lịch sử.
- Có test tenant isolation và tháng không có dữ liệu.

---

## BE-OP-02 — API tìm chuyến để thay xe

Mutation hiện có và tiếp tục giữ:

```http
POST /v1/operator/trips/{tripId}/substitute-vehicle
```

Phần còn thiếu:

```http
GET /v1/operator/trips
  ?search=51B-12345
  &status=IN_PROGRESS
  &from=2026-07-29
  &to=2026-07-30
  &page=1
  &pageSize=20
  &sortBy=departureAt
  &sortDir=desc
Authorization: Bearer <OPERATOR_ADMIN>
```

`search` tìm case-insensitive theo:

- `tripCode`
- Biển số xe
- Tên/mã tuyến

Response item:

```json
{
  "tripId": "uuid",
  "tripCode": "TRIP-20260729-001",
  "status": "IN_PROGRESS",
  "route": {
    "routeId": "uuid",
    "name": "HCM - Đà Lạt",
    "originName": "Hồ Chí Minh",
    "destinationName": "Đà Lạt"
  },
  "vehicle": {
    "vehicleId": "uuid",
    "licensePlate": "51B-12345",
    "status": "BROKEN"
  },
  "driver": {
    "userId": "uuid",
    "displayName": "Nguyễn Văn A",
    "phone": "0900000000"
  },
  "assistant": null,
  "departureAt": "2026-07-29T08:00:00+07:00",
  "arrivalEstimate": "2026-07-29T15:00:00+07:00",
  "canSubstituteVehicle": true
}
```

### Validation

- `from <= to`.
- `page >= 1`, `pageSize` clamp `1..100`.
- `status` phải thuộc enum Trip hiện hành.
- Không nhận `operatorId` từ client.

### Acceptance criteria

- Tìm đúng chuyến bằng biển số có dấu `-` hoặc không có dấu phân cách.
- Không trả chuyến của operator khác.
- Kết quả chọn được dùng trực tiếp làm `tripId` cho mutation thay xe hiện có.
- Có index phù hợp cho plate/trip code/date/status; không full scan ở production.
- Contract được bổ sung vào API Trip docs vì đây là conflict đang mở trong
  `frontend-api-coverage.md`.

---

## BE-OP-03 — Batch giá hàng hóa và enrich Parcel

### 5.3 Batch upsert giá theo tuyến

Endpoint mới:

```http
PUT /v1/operator/parcel-route-fares/{routeId}/batch
Authorization: Bearer <OPERATOR_ADMIN>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

Body:

```json
{
  "effectiveFrom": "2026-08-01T00:00:00+07:00",
  "effectiveUntil": null,
  "items": [
    { "sizeCategory": "SMALL", "priceVnd": 50000 },
    { "sizeCategory": "MEDIUM", "priceVnd": 80000 },
    { "sizeCategory": "LARGE", "priceVnd": 120000 },
    { "sizeCategory": "EXTRA_LARGE", "priceVnd": 180000 }
  ]
}
```

Response:

```json
{
  "routeId": "uuid",
  "items": [
    {
      "routeId": "uuid",
      "sizeCategory": "SMALL",
      "priceVnd": 50000,
      "effectiveFrom": "2026-08-01T00:00:00+07:00",
      "effectiveUntil": null,
      "created": true
    }
  ]
}
```

Business rules:

- `items` có từ 1 đến 4 phần tử.
- `sizeCategory` không trùng trong một request.
- `priceVnd > 0`.
- `effectiveUntil > effectiveFrom` nếu có.
- Route phải thuộc operator trong JWT.
- Toàn bộ batch atomic: một item lỗi thì không lưu item nào.
- Upsert theo `(operatorId, routeId, sizeCategory, effective window)` theo rule
  versioning hiện hành.
- Các endpoint tạo/sửa từng size hiện có vẫn chạy để backward compatibility.

### 5.4 Enrich danh sách Parcel

Giữ:

```http
GET /v1/operator/parcels
```

Mỗi item cần có tối thiểu:

```json
{
  "parcelId": "uuid",
  "parcelCode": "VRP-001",
  "status": "IN_TRANSIT",
  "pendingActionType": null,
  "trip": {
    "tripId": "uuid",
    "tripCode": "TRIP-001",
    "status": "IN_PROGRESS",
    "departureAt": "2026-07-29T08:00:00+07:00",
    "arrivalEstimate": "2026-07-29T15:00:00+07:00"
  },
  "route": {
    "routeId": "uuid",
    "routeName": "HCM - Đà Lạt",
    "originStationName": "Bến xe Miền Đông",
    "destinationStationName": "Bến xe Đà Lạt"
  },
  "sender": {
    "userId": "uuid",
    "displayName": "Nguyễn Văn A",
    "phone": "0900000000"
  },
  "recipient": {
    "userId": null,
    "displayName": "Trần Văn B",
    "phone": "0911111111"
  },
  "sizeCategory": "MEDIUM",
  "description": "Hàng dễ vỡ",
  "estimatedWeightKg": 12.5,
  "actualWeightKg": null,
  "estimatedVolumeM3": 0.08,
  "actualVolumeM3": null,
  "depositAmount": 80000,
  "balanceAmount": 0,
  "refundAmount": 0,
  "photoUrl": "https://...",
  "createdAt": "2026-07-29T07:00:00+07:00",
  "updatedAt": "2026-07-29T07:30:00+07:00"
}
```

Đây là additive response. Giữ các flat field cũ trong một release chuyển tiếp.

### 5.5 Chi tiết Parcel theo operator scope

Thêm:

```http
GET /v1/operator/parcels/{parcelId}
```

Response bao gồm toàn bộ list projection cộng:

- Lịch sử trạng thái.
- Chi tiết giá: base/deposit/additional/discount/refund/forfeiture.
- Voucher.
- Deadline và pending action.
- loaded/unloaded/delivery timestamps.
- Kích thước/khối lượng ước tính và thực tế.

Không mở rộng public `/v1/parcels/{id}` bằng dữ liệu operator-sensitive nếu có
nguy cơ lộ tenant.

### Acceptance criteria

- Batch atomic và idempotent.
- List/detail không N+1 Trip/Route/Identity.
- Không trả parcel của operator khác.
- Dữ liệu trip, route, sender, recipient đủ để UI không phải gọi từng endpoint.
- Có contract/integration test cho batch và tenant isolation.

---

## BE-OP-04 — Bổ sung thông tin người đặt Booking

Giữ endpoint:

```http
GET /v1/operator/bookings
GET /v1/operator/bookings/{id}
```

Bổ sung additive field `buyer` vào cả list và detail:

```json
{
  "buyer": {
    "userId": "uuid",
    "displayName": "Nguyễn Văn A",
    "phone": "0900000000",
    "email": "a@example.com",
    "avatarUrl": "https://..."
  }
}
```

Phân biệt:

- `buyer`: người tạo Booking/thanh toán.
- `passengers`: người đi xe; không dùng passenger đầu tiên thay cho buyer.

Nếu tài khoản buyer đã soft-delete, vẫn trả snapshot đã lưu lúc booking:

```json
{
  "userId": "uuid",
  "displayName": "Người dùng đã xóa",
  "phone": null,
  "email": null,
  "avatarUrl": null
}
```

### Acceptance criteria

- List và detail cùng một shape `buyer`.
- Filter `passengerPhone` hiện có vẫn giữ ý nghĩa cũ; nếu thêm `buyerPhone` phải
  là query riêng và được document.
- Không N+1 Identity lookup.
- Không lộ thông tin buyer của booking thuộc operator khác.
- Có test buyer khác passenger và buyer đã soft-delete.

---

## BE-OP-05 — Operator Revenue analytics

```http
GET /v1/operator/revenue/analytics?month=2026-07
Authorization: Bearer <OPERATOR_ADMIN>
```

Response:

```json
{
  "period": {
    "month": "2026-07",
    "from": "2026-07-01",
    "to": "2026-07-31",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "summary": {
    "totalRevenueVnd": {
      "currentValue": 2300000000,
      "previousValue": 2200000000,
      "changePercent": 4.55,
      "trend": "UP"
    },
    "ticketRevenueVnd": {
      "currentValue": 1890000000,
      "previousValue": 1685000000,
      "changePercent": 12.17,
      "trend": "UP"
    },
    "parcelRevenueVnd": {
      "currentValue": 410000000,
      "previousValue": 334000000,
      "changePercent": 22.75,
      "trend": "UP"
    },
    "averageRevenuePerTripVnd": {
      "currentValue": 6052632,
      "previousValue": 5900000,
      "changePercent": 2.59,
      "trend": "UP"
    }
  },
  "monthly": [
    {
      "month": "2025-08",
      "revenueVnd": 1200000000,
      "ticketRevenueVnd": 980000000,
      "parcelRevenueVnd": 220000000,
      "tripCount": 210
    }
  ],
  "routePerformance": [
    {
      "routeId": "uuid",
      "routeName": "HCM - Đà Lạt",
      "originName": "Hồ Chí Minh",
      "destinationName": "Đà Lạt",
      "tripCount": 45,
      "completedTripCount": 42,
      "bookingCount": 780,
      "parcelCount": 245,
      "revenueVnd": 420000000,
      "completionRatePercent": 93.33
    }
  ]
}
```

Quy ước:

- `monthly` luôn trả 12 tháng kết thúc tại tháng được chọn.
- `completionRatePercent = completedTripCount / tripCount * 100`.
- Revenue chỉ tính transaction đã completed/settled theo source of truth; refund
  và reversal phải được trừ đúng kỳ.
- Route performance nhóm theo route và destination trong tháng được chọn.

### Acceptance criteria

- Tenant lấy từ JWT.
- Tháng không có dữ liệu trả `0`.
- Mỗi metric có current, previous, change percent và trend.
- Tổng ticket + parcel khớp total, hoặc response phải có field revenue category
  khác để giải thích phần chênh lệch.
- Có test timezone cuối tháng, refund/reversal và tháng trước bằng `0`.

---

## 6. Task không tạo mới: Admin Stations

UI `src/pages/Admin/Stations/index.tsx` đã có các contract:

```text
GET   /v1/admin/stations
GET   /v1/admin/stations/{id}
PATCH /v1/admin/stations/{id}
POST  /v1/admin/stations/{primaryStationId}/merge
```

DTO đã bao phủ:

- Tên, địa chỉ, location.
- Thành phố/tỉnh.
- Tọa độ.
- Điện thoại/email.
- Giờ hoạt động.
- Tiện ích.
- Shuttle.
- Active/inactive.
- Merge và relink count.

Vì `Hỗ trợ.txt` không báo thiếu contract Station, backlog này không yêu cầu BE tạo
endpoint Station mới. Chỉ mở task riêng nếu runtime test chứng minh endpoint hiện
có sai response hoặc lỗi nghiệp vụ.

## 7. Definition of Done chung cho BE

Mỗi task chỉ được hoàn thành khi:

1. Public contract được cập nhật trong `src/docs/api/`.
2. OpenAPI/Swagger khớp method, path, query, body, response và error code.
3. Có unit test business rule.
4. Có integration test DB/service.
5. Có test RBAC và tenant isolation.
6. Có test pagination/filter/sort cho list endpoint.
7. Mutation có idempotency test.
8. Không N+1 với Identity/Operator/Trip lookup.
9. Log có `traceId`, không log token/PII nhạy cảm.
10. FE có thể bỏ dữ liệu mock mà không tự suy diễn hoặc ghép dữ liệu bằng nhiều
    request theo từng row.

## 8. Thứ tự triển khai đề xuất

Sprint/đợt 1:

1. `BE-ADM-04` — sửa Admin Platform Report.
2. `BE-OP-02` — tìm chuyến để dùng mutation thay xe hiện có.
3. `BE-OP-04` — buyer của Booking.
4. `BE-ADM-02` và `BE-FIN-01` — additive DTO, ít rủi ro.
5. `BE-POL-01` — CRUD Policy.
6. `BE-OP-03` — batch fare và Parcel projection.

Sprint/đợt 2:

1. `BE-ADM-01` — Admin Dashboard.
2. `BE-OP-01` — Operator Dashboard.
3. `BE-ADM-03` — Admin Revenue.
4. `BE-OP-05` — Operator Revenue.

Lý do: xử lý lỗi/chặn luồng vận hành trước, sau đó mới thay toàn bộ dữ liệu mock
ở dashboard và analytics.
