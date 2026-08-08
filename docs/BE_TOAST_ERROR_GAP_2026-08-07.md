# BE gap: standardized error responses for toast messaging

Ngày: 2026-08-07

## Tổng quan

Frontend hiện đang phụ thuộc vào response lỗi từ BE để hiển thị nội dung toast đúng. Khi BE trả thiếu `message`, trả format khác, hoặc chỉ trả `code` mà không có `message`, FE sẽ hiển thị fallback generic như:

- "Thao tác đã hoàn tất."
- "Đã xảy ra lỗi, vui lòng thử lại."
- hoặc nội dung không đúng với nghiệp vụ.

## Vấn đề hiện tại

FE đang dùng pattern như:

- `err instanceof Error ? err.message : ...`
- `setError(err.message || fallback)`
- `setMessage(t("...") || fallback)`

Điều này làm cho FE không thể hiện đúng nội dung toast khi BE không trả đúng error payload.

## Yêu cầu chung cho BE

Tất cả API lỗi cần trả về cấu trúc thống nhất gồm:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Voucher đã tồn tại",
  "error": {
    "code": "VOUCHER_ALREADY_EXISTS",
    "message": "Voucher đã tồn tại",
    "fields": [
      {
        "field": "code",
        "message": "Mã voucher đã được sử dụng"
      }
    ]
  }
}
```

### Bắt buộc

- `code`: mã lỗi cố định
- `message`: message người dùng có thể hiển thị trực tiếp trên toast
- `fields` (nếu có): các field lỗi chi tiết

## Các module cần ưu tiên cập nhật

### Admin System

- Operators
- Stations
- Locations
- Users
- Vouchers
- Packages
- Wallet Settlement
- Rag Audit

### Operator Admin / Operator Staff

- Trips / Schedules
- Routes
- Vehicles
- Bookings
- Parcels
- Operations
- Dispatch
- Staff
- Vouchers
- Wallet
- Packages
- Policies
- Settings

## Các nghiệp vụ cần có error code/message rõ ràng

### Voucher

- `VOUCHER_INVALID`
- `VOUCHER_NOT_FOUND`
- `VOUCHER_ALREADY_ACTIVE`
- `VOUCHER_ALREADY_INACTIVE`
- `VOUCHER_HAS_CONSENTS`
- `VOUCHER_ALREADY_EXISTS`

### Route

- `ROUTE_DUPLICATED`
- `ROUTE_NOT_FOUND`
- `ROUTE_INVALID`
- `ROUTE_CONFLICT`

### Schedule / Trip

- `SCHEDULE_CONFLICT`
- `SCHEDULE_TOO_LATE`
- `SCHEDULE_HAS_TRIPS`
- `SCHEDULE_NOT_FOUND`

### Parcel

- `PARCEL_NOT_FOUND`
- `PARCEL_INVALID_STATUS`
- `PARCEL_ACTION_FORBIDDEN`

### Rag document

- `RAG_DOCUMENT_NOT_FOUND`
- `RAG_DOCUMENT_ALREADY_APPROVED`
- `RAG_DOCUMENT_FORBIDDEN`

### User / operator

- `USER_NOT_FOUND`
- `USER_ALREADY_LOCKED`
- `USER_ALREADY_ACTIVE`
- `OPERATOR_NOT_FOUND`
- `OPERATOR_ALREADY_APPROVED`
- `OPERATOR_ALREADY_SUSPENDED`

## Ghi chú kỹ thuật cho BE

FE hiện đang parse lỗi theo các trường sau:

- `payload.message`
- `payload.error.message`
- `payload.error.fields`

Nếu BE trả format khác, FE sẽ không thể hiển thị đúng nội dung vào toast.

## Mẫu gửi BE

> FE đang gặp vấn đề khi hiển thị toast vì BE chưa trả error response theo format thống nhất. Vui lòng cập nhật tất cả API lỗi để trả về:
>
> - `code`
> - `message`
> - `fields` (nếu có)
>
> Mục tiêu là FE có thể hiển thị đúng nội dung toast cho các nghiệp vụ voucher, route, schedule, parcel, rag document và các action quản trị khác.

## Phụ lục: API/action cần BE bổ sung message và error

> Phạm vi: các API được FE gọi khi người dùng thực hiện action. Danh sách dưới đây là contract gap cần BE rà soát. FE chỉ parse các trường `message`, `error.code`, `error.message` và `error.fields`.
>
> Nếu API thành công, nên trả `message` nghiệp vụ rõ ràng khi action cần thông báo. Nếu API thất bại, bắt buộc trả `code` ổn định và `message` có thể hiển thị trên toast.

### 1. Contract response bắt buộc

#### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đã cập nhật thành công",
  "data": {}
}
```

#### Error

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Không thể thực hiện thao tác",
  "error": {
    "code": "RESOURCE_ACTION_FAILED",
    "message": "Nội dung chi tiết hiển thị trên toast",
    "fields": [
      {
        "field": "fieldName",
        "message": "Nội dung lỗi của field"
      }
    ]
  }
}
```

### 2. Auth và tài khoản

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `registerOperator` | Đăng ký thành công/thất bại, email đã tồn tại, mã số doanh nghiệp trùng | `OPERATOR_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS`, `OPERATOR_INVALID` |
| `verifyEmail` | OTP đúng, OTP sai hoặc hết hạn, email đã xác thực | `OTP_INVALID`, `OTP_EXPIRED`, `EMAIL_ALREADY_VERIFIED` |
| `resendVerificationEmail` | Gửi lại OTP thành công, giới hạn gửi, email không tồn tại | `OTP_RESEND_RATE_LIMITED`, `EMAIL_NOT_FOUND` |
| `setInitialPassword` | Token không hợp lệ/hết hạn, password không đạt yêu cầu | `INITIAL_PASSWORD_TOKEN_INVALID`, `INITIAL_PASSWORD_TOKEN_EXPIRED`, `PASSWORD_INVALID` |
| `requestForgotPassword` | Email không tồn tại, giới hạn yêu cầu, gửi OTP thất bại | `EMAIL_NOT_FOUND`, `FORGOT_PASSWORD_RATE_LIMITED` |
| `resetPassword` | OTP/token sai hoặc hết hạn, password không hợp lệ | `OTP_INVALID`, `OTP_EXPIRED`, `PASSWORD_INVALID` |
| `updateOperatorProfile` | Profile/operator không tồn tại, dữ liệu profile không hợp lệ | `PROFILE_NOT_FOUND`, `PROFILE_INVALID`, `PROFILE_UPDATE_FAILED` |
| `updateMyAvatar` | URL ảnh không hợp lệ, không có quyền cập nhật | `AVATAR_URL_INVALID`, `AVATAR_UPDATE_FORBIDDEN` |

### 3. Admin - operator, user, location và station

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `createAdminOperator` | Tạo operator thành công/thất bại, email hoặc mã số doanh nghiệp trùng | `OPERATOR_ALREADY_EXISTS`, `OPERATOR_INVALID` |
| `approveAdminOperator` | Duyệt thành công, operator không tồn tại hoặc đã duyệt | `OPERATOR_NOT_FOUND`, `OPERATOR_ALREADY_APPROVED` |
| `rejectAdminOperator` | Từ chối thành công, lý do bắt buộc, operator đã bị từ chối | `OPERATOR_NOT_FOUND`, `REJECTION_REASON_REQUIRED`, `OPERATOR_ALREADY_REJECTED` |
| `suspendAdminOperator` | Tạm khóa thành công, lý do bắt buộc, operator đã khóa | `OPERATOR_NOT_FOUND`, `SUSPENSION_REASON_REQUIRED`, `OPERATOR_ALREADY_SUSPENDED` |
| `createAdminUser` | Tạo user thành công, email đã tồn tại, role không hợp lệ | `USER_ALREADY_EXISTS`, `USER_INVALID_ROLE` |
| `lockAdminUser` | Khóa thành công, user không tồn tại hoặc đã khóa | `USER_NOT_FOUND`, `USER_ALREADY_LOCKED` |
| `unlockAdminUser` | Mở khóa thành công, user không tồn tại hoặc đã active | `USER_NOT_FOUND`, `USER_ALREADY_ACTIVE` |
| `createAdminLocation` | Tạo location thành công, location trùng | `LOCATION_ALREADY_EXISTS`, `LOCATION_INVALID` |
| `updateAdminLocation` | Location không tồn tại, dữ liệu không hợp lệ | `LOCATION_NOT_FOUND`, `LOCATION_INVALID` |
| `deleteAdminLocation` | Xóa thành công, location đang được sử dụng | `LOCATION_NOT_FOUND`, `LOCATION_IN_USE` |
| `updateAdminStation` | Station không tồn tại, dữ liệu không hợp lệ | `STATION_NOT_FOUND`, `STATION_INVALID` |
| `mergeAdminStations` | Station không tồn tại, trùng station, station đang được sử dụng | `STATION_NOT_FOUND`, `STATION_MERGE_INVALID`, `STATION_IN_USE` |
| `deleteAdminStation` | Station không tồn tại hoặc đang được sử dụng | `STATION_NOT_FOUND`, `STATION_IN_USE` |

### 4. Admin - voucher, campaign, package và wallet

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `createAdminVoucher` | Tạo voucher thành công, mã voucher trùng hoặc dữ liệu sai | `VOUCHER_ALREADY_EXISTS`, `VOUCHER_INVALID` |
| `updateAdminVoucher` | Voucher không tồn tại, mã trùng, voucher đã sử dụng | `VOUCHER_NOT_FOUND`, `VOUCHER_ALREADY_EXISTS`, `VOUCHER_IN_USE` |
| `deleteAdminVoucher` | Voucher không tồn tại hoặc đã có consent/booking | `VOUCHER_NOT_FOUND`, `VOUCHER_HAS_CONSENTS` |
| `activateAdminCampaign` | Campaign không tồn tại hoặc đã active | `CAMPAIGN_NOT_FOUND`, `CAMPAIGN_ALREADY_ACTIVE` |
| `deactivateAdminCampaign` | Campaign không tồn tại hoặc đã inactive | `CAMPAIGN_NOT_FOUND`, `CAMPAIGN_ALREADY_INACTIVE` |
| `createAdminSubscriptionPlan` | Plan trùng, dữ liệu giá/thời hạn không hợp lệ | `PLAN_ALREADY_EXISTS`, `PLAN_INVALID` |
| `updateAdminSubscriptionPlan` | Plan không tồn tại, plan đang được sử dụng | `PLAN_NOT_FOUND`, `PLAN_IN_USE` |
| `settleAdminTripSettlement` | Settlement không tồn tại, trạng thái không hợp lệ, đã settlement | `SETTLEMENT_NOT_FOUND`, `SETTLEMENT_INVALID_STATUS`, `SETTLEMENT_ALREADY_SETTLED` |
| `adjustAdminPlatformWallet` | Số tiền hoặc lý do không hợp lệ | `WALLET_ADJUSTMENT_INVALID`, `WALLET_ADJUSTMENT_FORBIDDEN` |
| `adjustAdminOperatorWallet` | Operator không tồn tại, số tiền không hợp lệ | `OPERATOR_NOT_FOUND`, `WALLET_ADJUSTMENT_INVALID` |
| `retryAdminInvoice` | Invoice không tồn tại hoặc không thể retry | `INVOICE_NOT_FOUND`, `INVOICE_RETRY_NOT_ALLOWED` |

### 5. Operator - staff, routes, stops và schedules

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `createOperatorUser` | Tạo nhân sự thành công, email đã tồn tại, role không hợp lệ | `USER_ALREADY_EXISTS`, `USER_INVALID_ROLE` |
| `resendInitialPassword` | User không tồn tại, user đã kích hoạt, giới hạn gửi | `USER_NOT_FOUND`, `USER_ALREADY_ACTIVATED`, `PASSWORD_RESEND_RATE_LIMITED` |
| `createOperatorStation` | Station trùng hoặc dữ liệu không hợp lệ | `STATION_ALREADY_EXISTS`, `STATION_INVALID` |
| `updateOperatorStation` | Station không tồn tại hoặc dữ liệu không hợp lệ | `STATION_NOT_FOUND`, `STATION_INVALID` |
| `deleteOperatorStation` | Station đang được route sử dụng | `STATION_NOT_FOUND`, `STATION_IN_USE` |
| `createOperatorStop` | Stop trùng hoặc tọa độ không hợp lệ | `STOP_ALREADY_EXISTS`, `STOP_INVALID` |
| `updateOperatorStop` | Stop không tồn tại hoặc đang được route sử dụng | `STOP_NOT_FOUND`, `STOP_IN_USE` |
| `deleteOperatorStop` | Stop đang được route sử dụng | `STOP_NOT_FOUND`, `STOP_IN_USE` |
| `createOperatorRouteFull` | Route trùng, tên/tuyến không hợp lệ | `ROUTE_DUPLICATED`, `ROUTE_INVALID` |
| `updateOperatorRouteFull` | Route không tồn tại, conflict, dữ liệu geometry sai | `ROUTE_NOT_FOUND`, `ROUTE_CONFLICT`, `ROUTE_INVALID` |
| `addRouteStop` | Route/stop không tồn tại, stop trùng thứ tự | `ROUTE_NOT_FOUND`, `STOP_NOT_FOUND`, `ROUTE_STOP_DUPLICATED` |
| `removeRouteStop` | Route/stop không tồn tại, không thể xóa stop bắt buộc | `ROUTE_NOT_FOUND`, `STOP_NOT_FOUND`, `ROUTE_STOP_REQUIRED` |
| `createAlternativeRoute` | Route trùng, vượt giới hạn, geometry sai | `ROUTE_DUPLICATED`, `ALTERNATIVE_ROUTE_LIMIT_REACHED`, `ROUTE_INVALID` |
| `updateAlternativeRoute` | Alternative route không tồn tại hoặc conflict | `ALTERNATIVE_ROUTE_NOT_FOUND`, `ROUTE_CONFLICT` |
| `deleteAlternativeRoute` | Alternative route không tồn tại hoặc đang được sử dụng | `ALTERNATIVE_ROUTE_NOT_FOUND`, `ALTERNATIVE_ROUTE_IN_USE` |
| `createOperatorDriverSchedule` | Lịch trùng, thời gian không hợp lệ | `SCHEDULE_CONFLICT`, `SCHEDULE_INVALID` |
| `updateOperatorDriverSchedule` | Lịch không tồn tại, đã phát sinh trip | `SCHEDULE_NOT_FOUND`, `SCHEDULE_HAS_TRIPS`, `SCHEDULE_CONFLICT` |
| `activateOperatorDriverSchedule` | Lịch không tồn tại hoặc đã active | `SCHEDULE_NOT_FOUND`, `SCHEDULE_ALREADY_ACTIVE` |
| `deactivateOperatorDriverSchedule` | Lịch không tồn tại hoặc đã có trip | `SCHEDULE_NOT_FOUND`, `SCHEDULE_HAS_TRIPS` |
| `deleteOperatorDriverSchedule` | Lịch không tồn tại hoặc đã phát sinh trip | `SCHEDULE_NOT_FOUND`, `SCHEDULE_HAS_TRIPS` |

### 6. Operator - vehicles, dispatch và operations

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `createOperatorVehicle` | Biển số trùng, loại xe không hợp lệ, dữ liệu ghế sai | `VEHICLE_ALREADY_EXISTS`, `VEHICLE_INVALID`, `SEAT_LAYOUT_INVALID` |
| `updateOperatorVehicle` | Xe không tồn tại, xe đang chạy trip, dữ liệu sai | `VEHICLE_NOT_FOUND`, `VEHICLE_IN_USE`, `VEHICLE_INVALID` |
| `createOperatorShuttleTrip` | Request/booking không tồn tại, xe hoặc tài xế không khả dụng | `SHUTTLE_REQUEST_NOT_FOUND`, `SHUTTLE_BOOKING_INVALID`, `VEHICLE_UNAVAILABLE`, `DRIVER_UNAVAILABLE`, `SHUTTLE_TRIP_CONFLICT` |
| `changeOperatorTripRoute` | Trip/route không tồn tại, trạng thái trip không cho đổi tuyến | `TRIP_NOT_FOUND`, `ROUTE_NOT_FOUND`, `TRIP_ROUTE_CONFLICT`, `TRIP_ACTION_FORBIDDEN` |
| `substituteOperatorTripVehicle` | Trip/xe/tài xế không tồn tại, capacity không đủ, trip không thể thay xe | `TRIP_NOT_FOUND`, `VEHICLE_NOT_FOUND`, `VEHICLE_UNAVAILABLE`, `TRIP_CAPACITY_EXCEEDED`, `TRIP_ACTION_FORBIDDEN` |
| `disruptOperatorTripNoSubstitution` | Trip không tồn tại, lý do thiếu, trạng thái không hợp lệ | `TRIP_NOT_FOUND`, `DISRUPTION_REASON_REQUIRED`, `TRIP_INVALID_STATUS`, `TRIP_ACTION_FORBIDDEN` |

### 7. Operator - parcels và voucher

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `reviewOperatorParcel` | Parcel không tồn tại, trạng thái không cho review | `PARCEL_NOT_FOUND`, `PARCEL_INVALID_STATUS`, `PARCEL_ACTION_FORBIDDEN` |
| `confirmOperatorParcelRefund` | Parcel/refund không tồn tại, đã refund | `PARCEL_NOT_FOUND`, `REFUND_ALREADY_CONFIRMED`, `PARCEL_ACTION_FORBIDDEN` |
| `overrideOperatorParcelCapacity` | Parcel không tồn tại, capacity không hợp lệ | `PARCEL_NOT_FOUND`, `PARCEL_CAPACITY_INVALID` |
| `requestOperatorParcelTransfer` | Parcel/trip không tồn tại, không thể chuyển | `PARCEL_NOT_FOUND`, `TRIP_NOT_FOUND`, `PARCEL_TRANSFER_NOT_ALLOWED` |
| `returnOperatorParcel` | Parcel không tồn tại, trạng thái không hợp lệ | `PARCEL_NOT_FOUND`, `PARCEL_INVALID_STATUS` |
| `cancelOperatorParcel` | Parcel không tồn tại, đã ở trạng thái terminal | `PARCEL_NOT_FOUND`, `PARCEL_CANCEL_NOT_ALLOWED` |
| `confirmOperatorParcelDelivery` | Parcel không tồn tại, bằng chứng giao hàng sai | `PARCEL_NOT_FOUND`, `DELIVERY_PROOF_INVALID`, `PARCEL_INVALID_STATUS` |
| `updateOperatorParcelStatus` | Parcel không tồn tại, chuyển trạng thái không hợp lệ | `PARCEL_NOT_FOUND`, `PARCEL_INVALID_STATUS`, `PARCEL_ACTION_FORBIDDEN` |
| `createOperatorParcelRouteFare` | Route fare trùng hoặc giá không hợp lệ | `PARCEL_FARE_ALREADY_EXISTS`, `PARCEL_FARE_INVALID` |
| `updateOperatorParcelRouteFare` | Fare không tồn tại hoặc giá không hợp lệ | `PARCEL_FARE_NOT_FOUND`, `PARCEL_FARE_INVALID` |
| `batchUpdateOperatorParcelRouteFares` | Một hoặc nhiều fare không hợp lệ | `PARCEL_FARE_BATCH_INVALID`, `PARCEL_FARE_NOT_FOUND` |
| `createOperatorVoucher` | Mã voucher trùng, dữ liệu không hợp lệ | `VOUCHER_ALREADY_EXISTS`, `VOUCHER_INVALID` |
| `updateOperatorVoucher` | Voucher không tồn tại, đã dùng hoặc dữ liệu sai | `VOUCHER_NOT_FOUND`, `VOUCHER_IN_USE`, `VOUCHER_INVALID` |
| `deleteOperatorVoucher` | Voucher không tồn tại hoặc có consent | `VOUCHER_NOT_FOUND`, `VOUCHER_HAS_CONSENTS` |
| `activateOperatorVoucher` | Voucher không tồn tại hoặc đã active | `VOUCHER_NOT_FOUND`, `VOUCHER_ALREADY_ACTIVE` |
| `deactivateOperatorVoucher` | Voucher không tồn tại hoặc đã inactive | `VOUCHER_NOT_FOUND`, `VOUCHER_ALREADY_INACTIVE` |
| `acceptOperatorVoucherConsent` | Consent/voucher không tồn tại hoặc đã xử lý | `VOUCHER_CONSENT_NOT_FOUND`, `VOUCHER_CONSENT_ALREADY_PROCESSED` |
| `rejectOperatorVoucherConsent` | Consent không tồn tại, lý do thiếu | `VOUCHER_CONSENT_NOT_FOUND`, `REJECTION_REASON_REQUIRED` |

### 8. RAG và notification

| FE API/action | BE cần trả message/error | Error code đề xuất |
|---|---|---|
| `uploadRagDocument` | File không hợp lệ, tài liệu trùng, upload thất bại | `RAG_DOCUMENT_INVALID`, `RAG_DOCUMENT_ALREADY_EXISTS`, `RAG_UPLOAD_FAILED` |
| `approveRagDocument` | Tài liệu không tồn tại, đã approve, không có quyền | `RAG_DOCUMENT_NOT_FOUND`, `RAG_DOCUMENT_ALREADY_APPROVED`, `RAG_DOCUMENT_FORBIDDEN` |
| `createRagFeedback` | Message không tồn tại, rating không hợp lệ | `RAG_MESSAGE_NOT_FOUND`, `RAG_RATING_INVALID` |
| `reloadRagRuntimeConfigs` | Không có quyền hoặc reload thất bại | `RAG_CONFIG_RELOAD_FAILED`, `RAG_CONFIG_FORBIDDEN` |
| `updateRagRuntimeConfig` | Key không tồn tại, giá trị không hợp lệ | `RAG_CONFIG_NOT_FOUND`, `RAG_CONFIG_INVALID` |
| `rollbackRagRuntimeConfig` | History không tồn tại, rollback không hợp lệ | `RAG_CONFIG_HISTORY_NOT_FOUND`, `RAG_CONFIG_ROLLBACK_INVALID` |
| `sendOperatorNotification` | Trip/operator không tồn tại, không có recipient, không có quyền | `TRIP_NOT_FOUND`, `OPERATOR_NOT_FOUND`, `NOTIFICATION_RECIPIENTS_NOT_FOUND`, `NOTIFICATION_FORBIDDEN` |

### 9. Quy tắc nghiệm thu BE

- Mỗi API action phải có `message` khi success nếu FE cần hiển thị toast thành công.
- Mỗi response lỗi phải có `error.code` ổn định, không dùng message tự do làm mã lỗi.
- Mỗi response lỗi phải có `message` ở top-level hoặc `error.message`.
- Validation nhiều field phải trả `error.fields`.
- Không trả HTTP error body rỗng.
- Không chỉ trả status code hoặc chỉ trả `code` mà thiếu message.
- Không trả lỗi dạng khác với envelope chung giữa các service.
- Nội dung `message` phải là nội dung an toàn để hiển thị trực tiếp trên toast, không chứa stack trace hoặc thông tin nhạy cảm.
- FE cần nhận được message cho các lỗi nghiệp vụ, không chỉ lỗi 4xx/5xx tổng quát.

### 10. FE reference

- API request/error parser: `src/api/client.ts`
- API definitions: `src/api/vietride.ts`
- Toast adapter: `src/hooks/useToastFeedback.ts`
- Toast provider: `src/components/toast/ToastProvider.tsx`



## 11. FE evidence matrix - endpoint/request/actual/expected

Danh sách cũ chỉ ghi tên action nên BE không thể đối chiếu trực tiếp với controller/route. Bảng dưới dùng endpoint public facade theo src/api/vietride.ts.

- Actual response là payload FE đang có thể nhận hoặc đã mô phỏng trong test FE. Endpoint chưa có network capture được ghi rõ "chưa có capture", không coi giả định là bằng chứng production.
- Expected response là contract tối thiểu để FE hiện toast. error.fields bắt buộc khi lỗi validation theo field.
- Mọi error.code phải đối chiếu canonical error registry trước khi chốt; mã trong tài liệu không tự động trở thành mã chính thức.

### 11.1 Contract chung

Request mutation: Authorization Bearer token, Content-Type application/json, Idempotency-Key uuid.

Actual thiếu thông tin:
{"success":false,"statusCode":409,"message":"Không thể thực hiện thao tác"}

Expected tối thiểu:
{"success":false,"statusCode":409,"message":"Mã tuyến đã tồn tại","error":{"code":"<CANONICAL_CODE>","message":"Mã tuyến đã tồn tại","fields":[{"field":"existingRouteId","message":"<id>"}]}}

FE đọc message để hiện toast, error.code để phân loại và error.fields để hiện chi tiết. Nên trả đồng thời top-level message và error.message.

### 11.2 Admin/operator resource actions

| Endpoint + request lỗi | Trường hợp | Actual FE cần đối chiếu | Expected BE |
|---|---|---|---|
| POST /v1/admin/operators body {email existing, businessRegistrationNumber BIZ-001} | email/mã số trùng | chưa có capture | 409, canonical duplicate code, message, fields email hoặc businessRegistrationNumber |
| POST /v1/admin/operators/{id}/approve | không tồn tại / đã duyệt | chưa có capture | 404/409, canonical code + message |
| POST /v1/admin/operators/{id}/reject body {reason empty} | thiếu reason / không tồn tại | chưa có capture | 400/404, fields.reason khi validation + message |
| POST /v1/admin/operators/{id}/suspend body {reason empty} | thiếu reason / đã suspended | chưa có capture | 400/409, fields.reason + message |
| POST /v1/admin/users body {email existing, role INVALID} | email trùng / role sai | chưa có capture | 409/422, fields email/role, code + message |
| PATCH /v1/admin/users/{id}/lock hoặc /unlock | không tồn tại / sai trạng thái | chưa có capture | 404/409, canonical code + message |
| POST /v1/admin/locations body {name Existing Station} | location trùng / body sai | chưa có capture | 409/422, code + message + fields nếu validation |
| PATCH /v1/admin/locations/{id} body {name empty} | không tồn tại / name invalid | chưa có capture | 404/422, fields.name + message |
| DELETE /v1/admin/locations/{id} | resource đang dùng | chưa có capture | 409, canonical in-use code + message |
| POST /v1/admin/vouchers body {code USED, discountValue -1} | code trùng / discount invalid | chưa có capture | 409/422, fields code/discountValue + message |
| PATCH /v1/admin/vouchers/{id} body {code USED} | không tồn tại / trùng / đã dùng | chưa có capture | 404/409, code + message |
| DELETE /v1/admin/vouchers/{id} | có consent/booking | chưa có capture | 409, canonical dependency code + message |
| POST /v1/admin/campaigns/{id}/activate hoặc /deactivate | không tồn tại / sai trạng thái | chưa có capture | 404/409, code + message |
| POST /v1/admin/subscription-plans body {priceVnd -1, durationMonths 0} | giá/thời hạn sai hoặc plan trùng | chưa có capture | 422/409, fields priceVnd/durationMonths + message |

### 11.3 Routes, schedules, vehicles, parcels và operations

| Endpoint + request lỗi | Trường hợp | Actual FE cần đối chiếu | Expected BE |
|---|---|---|---|
| POST /v1/operator/routes/full body {name TPHCM-Dalat, stops []} | route trùng / geometry invalid | FE test mô phỏng 409 với code ROUTE_DUPLICATED, message và fields.existingRouteId | code theo registry; error.message; duplicate có fields.existingRouteId |
| PATCH /v1/operator/routes/{id}/full body {name empty} | không tồn tại / conflict / invalid | chưa có capture | 404/409/422, code + message + fields |
| POST /v1/operator/routes/{routeId}/stops body {stopId, sequence 1} | route/stop không tồn tại hoặc sequence trùng | chưa có capture | 404/409, code + message |
| POST /v1/operator/driver-schedules body {departureTime invalid} | conflict / datetime invalid | chưa có capture | 409/422, fields.departureTime + message |
| PATCH /v1/operator/driver-schedules/{id} | không tồn tại / đã có trip / conflict | chưa có capture | 404/409, code + message |
| POST /v1/operator/vehicles body {licensePlate 51A-00000, seatCount 0} | plate trùng / seat invalid | chưa có capture | 409/422, fields licensePlate/seatCount + message |
| PATCH /v1/operator/vehicles/{id} body {seatCount 0} | không tồn tại / đang dùng / invalid | chưa có capture | 404/409/422, code + message + fields |
| POST /v1/operator/parcels/{id}/review hoặc /refund/confirm | không tồn tại / status không hợp lệ / đã refund | chưa có capture | 404/409, code + message |
| PATCH /v1/operator/parcels/{id}/capacity body {capacity -1} | capacity invalid | chưa có capture | 422, fields.capacity + message |
| POST /v1/operator/parcels/{id}/transfer body {tripId} | parcel/trip không tồn tại hoặc forbidden | chưa có capture | 404/409/403, code + message |
| POST /v1/operator/parcels/{id}/return hoặc /cancel | status terminal/invalid | chưa có capture | 404/409, code + message |
| POST /v1/operator/parcels/{id}/delivery/confirm body {proofUrl empty} | proof/status invalid | chưa có capture | 422/409, fields.proofUrl khi cần + message |
| PATCH /v1/operator/parcels/{id}/status body {status INVALID} | transition invalid | chưa có capture | 409/422, fields.status + message |
| POST /v1/operator/vouchers/{id}/activate hoặc /deactivate | không tồn tại / đã active/inactive | chưa có capture | 404/409, code + message |
| POST /v1/operator/voucher-consents/{id}/reject body {reason empty} | thiếu reason / consent không tồn tại | chưa có capture | 404/422, fields.reason + message |
| POST /v1/operator/trips/{tripId}/route body {routeId} | trip/route không tồn tại hoặc không cho đổi | chưa có capture | 404/409/403, code + message |
| POST /v1/operator/trips/{tripId}/vehicle body {vehicleId} | xe unavailable/capacity thiếu | chưa có capture | 404/409, fields.vehicleId nếu cần + message |
| POST /v1/operator/trips/{tripId}/disrupt body {reason empty} | thiếu reason/status invalid | chưa có capture | 422/409, fields.reason + message |

### 11.4 RAG, notification và revenue/report

| Endpoint + request lỗi | Actual FE cần đối chiếu | Expected BE |
|---|---|---|
| POST /v1/rag/documents multipart file invalid | chưa có capture | 400/409, canonical code + message + fields.file nếu validation |
| POST /v1/rag/documents/{id}/approve | chưa có capture | 404/409/403, code + message |
| POST /v1/rag/feedback body {messageId, rating 6} | chưa có capture | 404/422, fields.rating + message |
| POST /v1/rag/runtime-configs/reload | chưa có capture | 403/500, code + message |
| PATCH /v1/rag/runtime-configs/{key} body {value null} | chưa có capture | 404/422, fields.value + message |
| POST /v1/operator/notifications body {recipientIds empty, message empty} | chưa có capture | 400/404/403, fields recipientIds/message + message |
| GET /v1/admin/dashboard/summary?from=2026-07-31 | chưa có capture | 400, canonical missing-date code, message, fields.to |
| GET /v1/admin/dashboard/summary?from=2026-07-31&to=2026-07-01 | chưa có capture | 400, canonical invalid-range code, message, fields.from/to |
| GET /v1/admin/revenue/analytics?from=2026-01-01&to=2026-12-31&groupBy=day | chưa có capture | 400, canonical group-by code, message, fields.groupBy |
| GET /v1/operator/revenue/analytics?month=2026-07&year=2026 | chưa có capture | 400, canonical mutually-exclusive-period code, message, fields.month/year |
| GET /v1/operator/parcels/reports/summary?from=2026-07-31&to=2026-07-01 | chưa có capture | 400, canonical invalid-range code, message, fields.from/to |
| GET /v1/operator/reports/revenue/export?from=2026-01-01&to=2026-12-31 | chưa có capture; download lỗi parse từ JSON blob | 400, JSON envelope có canonical code/message/fields, không body rỗng |
| GET /v1/operator/reports/refunds/export?from=2026-01-01&to=2026-12-31 | chưa có capture | 400, JSON envelope có code/message/fields |
| GET /v1/operator/parcels/reports/export?from=2026-07-31&to=2026-07-01&format=csv | chưa có capture | 400, JSON envelope có code/message/fields |

### 11.5 Lỗi hệ thống mọi endpoint

| Request | Actual FE hiện có | Expected |
|---|---|---|
| Auth request không có/expired token | FE test mô phỏng 401 với AUTH_TOKEN_INVALID và error.message | canonical auth code + message, không body rỗng |
| Request không đủ quyền | FE test mô phỏng 403 với TRACKING_ACCESS_DENIED và error.message | canonical forbidden code + message |
| Body sai JSON/schema | chưa có capture | 400/422, validation code + message + fields từng field |
| Lỗi ngoài dự kiến | chưa có capture | 500, internal-error canonical code + message an toàn, không stack trace |

### 11.6 Checklist BE phản hồi

Mỗi dòng cần capture gồm method, URL đầy đủ, query/body (che token), HTTP status và raw response body. Chỉ đánh dấu resolved khi code đã đối chiếu registry, có message hiển thị được, fields đúng tên khi validation và FE có thể dùng payload viết regression test. Nếu registry dùng mã khác, ghi mã canonical thực tế; các mã mô tả trong tài liệu không phải mã chốt.


## 12. Capture-only handoff (BE gap được công nhận)

> Phần này là nguồn duy nhất để đánh dấu BE gap. Các bảng ở mục 2-8 và mục 11 chỉ là inventory/capture request, không phải danh sách lỗi BE cần sửa nếu chưa có raw network capture.

### 12.1 Quy ước contract

- Error code trong các capture dưới đây là code đang xuất hiện trong FE test/mock, chưa có bằng chứng đây là canonical registry đã được BE chốt.
- FE hiện ưu tiên đọc payload.message, sau đó payload.error.message; code và fields đọc từ payload.error.code và payload.error.fields.
- FE không dịch error code thành message nghiệp vụ. BE chịu trách nhiệm trả message an toàn để hiển thị trực tiếp. FE chỉ chịu trách nhiệm fallback/i18n cho lỗi kỹ thuật hoặc message không có.
- Với message nghiệp vụ, đề nghị BE trả tiếng Việt theo locale/header của request; nếu backend chưa hỗ trợ locale thì trả message tiếng Việt thống nhất. FE không tự dịch message tự do của BE.

### 12.2 Matrix raw capture đã có trong repository

| Màn hình/action | Function trong vietride | Method + URL | Request capture | Status + raw response hiện tại | Response/toast mong muốn | Trạng thái |
|---|---|---|---|---|---|---|
| Manager Operations - tải latest tracking/shuttle trip bị từ chối | getShuttleTripLatest(shuttleTripId) | GET /v1/tracking/shuttle-trips/shuttle-1/latest | Authenticated GET; không body | 403 {"success":false,"statusCode":403,"error":{"code":"TRACKING_ACCESS_DENIED","message":"Tracking access denied."}} | 403; giữ canonical code sau registry check; nên có top-level message và error.message. Toast: message BE trả, ví dụ “Bạn không có quyền xem tracking chuyến này.” | Không đánh dấu BE gap về field; payload đã có code/message. |
| Manager Routes - tạo route trùng | createOperatorRouteFull(request) | POST /v1/operator/routes/full | JSON body {} trong test capture; thực tế gửi OperatorRouteFullRequest | 409 {"success":false,"statusCode":409,"error":{"code":"ROUTE_DUPLICATED","message":"Route already exists.","fields":[{"field":"existingRouteId","message":"2829ae3f-97f8-49d1-9b1a-35623fd96d80"}]}} | 409; giữ canonical code sau registry check; nên thêm top-level message tiếng Việt. Toast: “Tuyến đã tồn tại.”; fields dùng để dẫn tới route hiện có. | Không đánh dấu BE gap về field; payload đã đủ code/message/fields. |
| Manager Routes - lấy route không tồn tại | apiRequest route detail contract test | GET /v1/operator/routes/missing | Authenticated GET; không body | 404 {"success":false,"statusCode":404,"error":{"code":"ROUTE_NOT_FOUND","message":"Route not found."}} | 404; canonical code + message. Toast: “Không tìm thấy tuyến.”; fields không bắt buộc cho not-found. | Không đánh dấu BE gap về field; payload đã đủ code/message. |
| Admin Operators - request sau khi access token hết hạn | getAdminOperators() | GET /v1/admin/operators | Authenticated GET với token hết hạn; FE tự refresh rồi retry | Lần 1: 401 {"success":false,"statusCode":401,"error":{"code":"AUTH_TOKEN_INVALID","message":"Authorization header is required or access token is invalid."}}; sau refresh mock trả 200 {"data":{"operatorId":"op-1"}} | Nếu refresh/retry thất bại: 401 canonical auth code + message. Toast: “Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.” | Không đánh dấu BE gap về field; raw 401 đã có code/message. Cần BE xác nhận canonical auth code và message tiếng Việt. |

### 12.3 Những gì chưa đủ điều kiện đánh dấu BE gap

Các dòng trong mục 11 có “chưa có capture” chỉ là request mẫu để QA/FE lấy capture. Chưa được kết luận BE thiếu error.code, error.message hoặc error.fields. Khi có capture, bổ sung nguyên văn status/body vào mục 12.2 rồi mới đánh dấu gap theo từng endpoint.

### 12.4 Format capture bắt buộc gửi BE

Screen/action:
vietride function:
HTTP method + full URL:
Request query/body (đã che token):
HTTP status:
Raw response body:
Expected toast/message:
Canonical error code confirmed by BE: yes/no
Missing field: error.code / error.message / error.fields / none
