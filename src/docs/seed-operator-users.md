# Seed tài khoản nhân viên nhà xe

Script `scripts/seed-operator-users.mjs` tạo dữ liệu qua API thật:

```http
POST /v1/operator/users
```

Tài khoản được gắn vào đúng nhà xe của `OPERATOR_ADMIN` trong JWT. Script không
nhận hoặc tự gán `operatorId`.

## Dữ liệu mặc định

Mỗi lần chạy tạo tối đa 24 tài khoản:

- 10 `OPERATOR_STAFF`
- 8 `DRIVER`
- 6 `ASSISTANT`

Email và số điện thoại được sinh cố định để chạy lại có thể bỏ qua tài khoản đã
tồn tại. Mặc định email dùng domain không nhận thư `vietride.test`.

## Xem trước, không ghi dữ liệu

```powershell
npm run seed:operator-users
```

Hoặc thay số lượng:

```powershell
npm run seed:operator-users -- --staff=15 --drivers=10 --assistants=8
```

Dry-run không cần token và không gọi API.

## Seed vào local hoặc staging

Cách an toàn nhất là dùng access token của một `OPERATOR_ADMIN`:

```powershell
$env:VIETRIDE_SEED_API_BASE_URL='http://localhost:3000'
$env:VIETRIDE_SEED_ACCESS_TOKEN='<operator-admin-access-token>'
npm run seed:operator-users -- --apply
```

Hoặc để script tự đăng nhập:

```powershell
$env:VIETRIDE_SEED_API_BASE_URL='https://staging-api.example.com'
$env:VIETRIDE_SEED_ADMIN_EMAIL='operator-admin@example.com'
$env:VIETRIDE_SEED_ADMIN_PASSWORD='<password>'
npm run seed:operator-users -- --apply
```

Không ghi token/password vào source, `package.json` hoặc file được commit.

## Dùng email thật để nhận link đặt mật khẩu

API không nhận password khi tạo nhân viên. Identity Service gửi link đặt mật
khẩu ban đầu đến từng email. Muốn đăng nhập bằng các tài khoản seed, dùng một
domain/mail catcher mà nhóm phát triển kiểm soát:

```powershell
npm run seed:operator-users -- --apply --email-prefix=qa --email-domain=mail-test.example.com
```

Nếu hệ thống hỗ trợ email plus-addressing, có thể cấu hình catch-all domain để
nhận toàn bộ thư seed.

## Chạy lại

Script tải danh sách user hiện có và bỏ qua email đã tồn tại. Kết quả cuối hiển
thị số lượng:

```text
created / skipped / failed
```

Script không xóa, khóa hoặc thay đổi tài khoản đã tồn tại.

## Production guard

Ghi dữ liệu vào `https://api.vietride.online` bị chặn mặc định. Chỉ sau khi đã
xác nhận đúng operator, giới hạn subscription và tác động gửi email mới dùng:

```powershell
$env:VIETRIDE_SEED_API_BASE_URL='https://api.vietride.online'
$env:VIETRIDE_SEED_ACCESS_TOKEN='<operator-admin-access-token>'
npm run seed:operator-users -- --apply --allow-production
```

Production vẫn dùng domain email đã truyền vào command. Không dùng số điện
thoại/email seed giả cho luồng có gửi SMS hoặc dữ liệu báo cáo thật.

## Lưu ý subscription

Việc tạo user có thể bị giới hạn bởi plan:

- `maxDrivers`
- `maxAssistants`
- `maxOperatorUsers`

Nếu vượt giới hạn, script tiếp tục các record còn lại, báo `failed` và trả exit
code khác `0`.
