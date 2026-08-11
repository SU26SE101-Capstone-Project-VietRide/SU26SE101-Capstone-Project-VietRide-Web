# BE-REQUEST — Thanh toán VNPay xong bị văng về `/login`

**Ngày:** 2026-08-11
**Người gửi:** FE (operator web — `app.vietride.online`)
**Luồng ảnh hưởng:** Manager → Gói dịch vụ → mua/nâng cấp gói → VNPay → quay về web
**Mức độ:** Cao — người dùng đã trả tiền nhưng không thấy được kết quả giao dịch

---

## 1. Hiện tượng

Sau khi thanh toán xong trên cổng VNPay, trình duyệt quay về
`https://app.vietride.online/login` thay vì trang kết quả
`https://app.vietride.online/payments/return?vnp_...`.
Toàn bộ query `vnp_*` bị mất, không còn cách nào xem lại kết quả giao dịch đó.

## 2. Những gì FE đã kiểm tra và đã tự sửa

FE đã xác minh trên bản deploy thật (`app.vietride.online`) rằng phần hạ tầng FE **không hỏng**:

| Kiểm tra | Kết quả |
|---|---|
| nginx FE có history-fallback cho SPA (`try_files $uri /index.html`) | ✅ có |
| Bundle đang deploy có route `/payments/return` | ✅ có |
| Nạp trực tiếp `/payments/return?vnp_...` **khi còn phiên đăng nhập** | ✅ render đúng trang kết quả, gọi được `/v1/payments/vnpay-return-status` và nhận `PAYMENT_SIGNATURE_INVALID` cho query giả (đúng như mong đợi) |
| Nạp `/payments/return?vnp_...` **khi KHÔNG còn phiên** | ❌ bị `PrivateRoute` đá về `/login`, mất query |

Từ đó có **hai nguyên nhân có thể** cùng dẫn tới đúng một hiện tượng, và FE đã bịt cả hai ở phía mình:

1. **Phiên đăng nhập không còn ở thời điểm quay về** (hết hạn / refresh token bị revoke / người dùng
   quay về từ app ngân hàng hoặc trình duyệt khác). → Trước đây `PrivateRoute` đá thẳng ra `/login`.
2. **`vnp_ReturnUrl` trỏ về một path khác `/payments/return`** (ví dụ `/` hoặc domain/path cũ).
   → Route `/` và catch-all `*` của FE trước đây đá vô điều kiện về `/login`, nuốt luôn query `vnp_*`.

**FE đã sửa (đã merge phía FE, không cần BE làm gì cho phần này):**

- `/payments/return` chuyển thành **route public**. Hợp lệ vì
  `GET /v1/payments/vnpay-return-status` là `[AllowAnonymous]` và được xác thực bằng chính chữ ký
  VNPay trong query — không cần access token để kết luận.
- Khi không có phiên, trang kết quả **poll `vnpay-return-status`** và kết luận theo
  `PaymentStatus` (`SUCCEEDED` / `FAILED` / `EXPIRED`), kèm thông báo "phiên đã hết, đăng nhập lại
  để xem gói".
- `getOperatorSubscription()` trả 401 giữa chừng thì **không** báo lỗi/không đá ra login nữa,
  mà chuyển sang nhánh xác minh public ở trên.
- `/` và `*` giờ giữ lại query `vnp_*` và chuyển tiếp về `/payments/return`; người đang đăng nhập
  thì về home theo role thay vì bị đẩy ra `/login`.

## 3. Việc cần BE kiểm tra / xử lý

### 3.1 (Bắt buộc) Xác nhận `VNPAY_WEB_RETURN_URL` trên môi trường prod

Giá trị đúng phải là:

```
VNPAY_WEB_RETURN_URL=https://app.vietride.online/payments/return
```

Trong repo BE giá trị này đúng ở cả 4 chỗ khai báo:

- `.env.example:112`
- `apps/payment/src/VietRide.Payment.Api/appsettings.json:23` (`VnPay.WebReturnUrl`)
- `apps/payment/src/VietRide.Payment.Infrastructure/VnPay/VnPayOptions.cs:10` (default)
- `infra/docker/docker-compose.prod.yml:248`

Nhưng **file `.env` thật trên server có thể đang override** bằng giá trị cũ (thiếu `/payments/return`,
sai domain, hoặc còn trỏ về `vietride.online`). Nhờ BE:

1. `docker compose -f infra/docker/docker-compose.prod.yml exec payment env | grep VNPAY_WEB_RETURN_URL`
   (hoặc tương đương) để đọc giá trị **đang chạy**, không phải giá trị trong repo.
2. Đối chiếu với chuỗi `vnp_ReturnUrl` thực tế trong `paymentRedirectUrl` mà API
   `POST /v1/operator/subscription/upgrade` trả về cho FE — decode param `vnp_ReturnUrl` và xác nhận
   nó đúng `https://app.vietride.online/payments/return`.

### 3.2 (Bắt buộc) Xác nhận `VnPay.WebEnabled` đang bật ở prod

`VnPayClient.ResolveReturnUrl()` gọi `EnsureReturnModeEnabled(OPERATOR_WEB)`; nếu `WebEnabled=false`
thì ném `VnPayReturnModeDisabledException` với code `VNPAY_WEB_DISABLED`. Nhờ xác nhận cờ này đang
`true` trên prod.

### 3.3 (Nên có) Log lại `vnp_ReturnUrl` khi tạo redirect URL

Ở `VnPayClient.BuildRedirectUrl` (`apps/payment/src/VietRide.Payment.Infrastructure/VnPay/VnPayClient.cs:171`),
xin log ở mức Information: `vnp_TxnRef`, `returnMode`, `vnp_ReturnUrl` đã resolve. Hiện tại khi
người dùng báo "bị đá về login" thì không có cách nào từ log biết BE đã gửi return URL nào cho VNPay,
phải suy đoán. Một dòng log là đủ để loại trừ nhánh nguyên nhân #2 trong 10 giây.

### 3.4 (Nên có) Đối chiếu cấu hình trên cổng merchant VNPay

Một số merchant profile của VNPay có cấu hình "URL trả về" riêng ở portal. Nếu profile đang dùng cho
prod còn cấu hình một URL cũ, VNPay có thể ưu tiên URL đó thay vì `vnp_ReturnUrl` trong request.
Nhờ team đối chiếu giá trị trên portal VNPay với `VNPAY_WEB_RETURN_URL`.

### 3.5 (Đề xuất, không chặn) Cho phép `vnp_ReturnUrl` mang thêm `paymentId`

Hiện `WebReturnUrl` là chuỗi tĩnh, không kèm định danh giao dịch. Nếu BE gắn thêm
`?paymentId=<guid>` (hoặc tương đương) vào return URL, FE sẽ luôn hiển thị đúng ngữ cảnh giao dịch
kể cả khi `sessionStorage` đã mất (mở tab mới, đổi trình duyệt). Không bắt buộc — chỉ giúp UX tốt hơn.
Lưu ý: nếu làm thì chữ ký `vnp_SecureHash` vẫn tính trên đúng chuỗi query gốc như hiện tại,
FE vẫn forward nguyên `location.search` lên `vnpay-return-status`.

## 4. Không cần BE đổi gì ở các điểm sau

- `GET /v1/payments/vnpay-return-status` đang `[AllowAnonymous]` — **giữ nguyên**, FE đang dựa vào
  đúng đặc tính này để hiển thị kết quả khi mất phiên.
- Response `VnPayReturnStatusResponse` (`vnPayTxnRef`, `paymentId`, `referenceType`, `referenceId`,
  `status`) đủ dùng, không cần thêm field.
- Contract IPN và luồng cập nhật trạng thái — không đụng tới.

## 5. Cách tái hiện / nghiệm thu

1. Đăng nhập bằng tài khoản `OPERATOR_ADMIN`, vào Manager → Gói dịch vụ, mua một gói.
2. Trước khi bấm thanh toán trên VNPay, mở DevTools → Application → Local Storage
   → xoá key `auth` (mô phỏng phiên hết hạn).
3. Hoàn tất thanh toán trên VNPay.
4. **Kỳ vọng sau khi FE deploy bản sửa:** quay về `/payments/return?vnp_...`, thấy kết quả giao dịch
   + thông báo "phiên đã hết, đăng nhập lại", **không** bị đá ra `/login`.
5. Song song, kiểm tra log BE theo mục 3.3 để xác nhận `vnp_ReturnUrl` đúng.

---

**Liên hệ FE:** các thay đổi phía FE nằm ở `src/App.tsx`, `src/components/EntryRedirect.tsx`,
`src/pages/Manager/Packages/PaymentReturn.tsx`.
