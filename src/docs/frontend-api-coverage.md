# VietRide frontend API coverage

Ngày rà soát: 2026-07-26

Phạm vi role:

- `SYSTEM_ADMIN`
- `OPERATOR_ADMIN`
- `OPERATOR_STAFF`

Nguồn đã đối chiếu:

1. `API-Admin-Ops-Day40.md`
2. `API-Booking.md`
3. `API-Day41-43.md`
4. `API-Driver-Ops-Day39.md`
5. `API-ForgetPassword.md`
6. `API-Invoice-OperatorWallet-Settlement.md`
7. `API-Notification.md`
8. `API-Parcel.md`
9. `API-polyline.md`
10. `API-RAG.md`
11. `API-Subscription.md`
12. `API-Tracking.md`
13. `API-Trip.md`
14. `API-Voucher.md`

## Coverage theo role

| Nhóm API | SYSTEM_ADMIN | OPERATOR_ADMIN | OPERATOR_STAFF | UI chính |
|---|---|---|---|---|
| Identity / Admin Ops | Có | Không áp dụng | Không áp dụng | Admin Users, Operators, Activity Logs |
| Location / Station normalization | Có | Có | Có quyền đọc/tạo-link theo contract | Admin Locations, Admin Stations, Manager Routes |
| Route / fare / alternative route / polyline | Không áp dụng | Có đầy đủ mutation | Có quyền đọc | Manager Routes, Route Extensions |
| Vehicle / driver schedule | Không áp dụng | Có đầy đủ mutation | Có quyền đọc | Manager Vehicles, Trips |
| Trip cargo / substitute / disrupt | Không áp dụng | Có đầy đủ | Cargo read-only | Manager Trips |
| Booking operator view | Không áp dụng | Có | Có | Manager Bookings |
| Parcel operator operations / fare | Không áp dụng | Có đầy đủ | Có các operation được contract cho phép | Manager Parcels |
| Voucher / consent | Có | Có | Có quyền đọc/phản hồi theo contract | Admin Vouchers, Manager Vouchers |
| Subscription | Quản trị plan | Xem/upgrade/retry payment | Xem | Admin Subscription Plans, Manager Subscription |
| Wallet / settlement / invoice | Platform wallet, adjust, settle, retry PDF | Operator wallet, ledger, invoice | Quyền đọc theo contract | Admin Wallet Settlement, Manager Accounting |
| Tracking | Không áp dụng | Có | Có | Manager Fleet Map |
| RAG | Audit/config/document + chat | Chat theo operator scope | Chat theo operator scope | Admin RAG Audit, RAG Assistant |
| Notification | Có | Có | Có | Notification Center |
| Reports / export / DLQ | Platform report + DLQ | Operator reports/exports | Operator reports/exports | Dashboards, Reports, Admin System Health |
| Forgot password / auth recovery | Có | Có | Có | Forgot Password |

## Thay đổi thực hiện trong đợt rà soát

- Sửa DTO và query của Admin Location theo contract Trip; thêm UI CRUD location.
- Sửa response Admin Voucher Consent và thêm UI xem consent.
- Thêm tạo `SYSTEM_ADMIN` và bộ lọc riêng tài khoản operator trong Admin Users.
- Thêm điều chỉnh Platform/Operator wallet và retry PDF invoice.
- Hoàn thiện RAG document upload, runtime config/history/rollback và chat SSE có feedback.
- Thêm fare template và alternative route/geometry UI.
- Thêm tạo/sửa parcel route fare cho `OPERATOR_ADMIN`.
- Thêm trip cargo capacity cho cả hai operator role; thêm thay xe và disrupt cho `OPERATOR_ADMIN`.
- Bổ sung `Idempotency-Key` bắt buộc cho trip substitute/disrupt.

## Endpoint không gắn vào ba dashboard role

Các nhóm sau được chủ động loại khỏi phạm vi vì contract xác định actor khác hoặc
chỉ dành cho service-to-service:

- Public/passenger search, booking, voucher và parcel creation/receipt flows.
- Driver/assistant schedule, boarding, stop arrival, parcel scan/reweigh/unload flows.
- Tất cả `/internal/**` endpoint, health endpoint và Firebase token helper không
  trực tiếp tạo ra màn hình nghiệp vụ cho ba role.

## Contract conflict còn mở

Không triển khai UI dựa trên các endpoint chỉ xuất hiện trong tài liệu tổng quan
nhưng không có hợp đồng runtime chi tiết tương ứng:

- Operator trip create/update/cancel/list.
- Seat disable/enable và capacity management theo trip.
- Route ETA mock không có public operator contract tương ứng.

`API-Trip.md` xác nhận trip được sinh bởi background job và không expose HTTP tạo
trip trực tiếp. Endpoint operator stop-arrival cũ cũng không được dùng thay cho
driver/assistant flow mới. Cần BE phát hành method, path, role, request/response và
error contract đã code-verify trước khi FE nối các nhóm này.
