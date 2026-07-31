---
name: i18n-sync
description: Thêm, đổi tên hoặc kiểm tra key dịch của VietRide trên 5 namespace × vi/en. Dùng khi thêm chuỗi hiển thị vào màn hình, khi UI hiện ra key thô thay vì chữ, hoặc khi cần kiểm tra parity vi/en trước khi commit. Kèm script check-i18n.mjs chạy được ngay.
---

# Đồng bộ key dịch vi / en

Cấu hình ở `src/i18n/index.ts`: 5 namespace — `common` (default), `nav`, `login`, `admin`,
`manager` — mỗi namespace một file JSON trong `src/i18n/locales/vi/` và `.../en/`.
`fallbackLng: "vi"`, detect theo `localStorage` key `vietride_lang`.

**Bất biến: mọi key phải tồn tại ở cả hai ngôn ngữ.** Fallback `vi` khiến key thiếu bản `en`
vẫn hiện chữ tiếng Việt trên UI tiếng Anh — lỗi im lặng, không ai phát hiện qua test.

## Kiểm tra

```bash
node .claude/skills/i18n-sync/check-i18n.mjs
```

In số key mỗi namespace và liệt kê key lệch, exit 1 khi có lệch. `--json` để lấy output máy đọc.

Baseline lúc tạo skill (2026-07-31): common 164 · nav 42 · login 106 · admin 570 · manager 1404
— parity 100%. Nếu chạy ra `FAIL` thì đó là do thay đổi mới, không phải nợ cũ.

## Chọn namespace

| Namespace | Dùng cho |
|---|---|
| `common` | Nút, nhãn, trạng thái, thông báo dùng ở cả Admin lẫn Manager (`save`, `cancel`, `close`, pagination) |
| `nav` | Sidebar, topbar, tên menu |
| `login` | Login, register, forgot/set password |
| `admin` | Màn thuộc `src/pages/Admin/` |
| `manager` | Màn thuộc `src/pages/Manager/` |

Đặt key theo màn, lồng một cấp: `stations.loadFailed`, `staff.inviteSuccess`.
Chuỗi dùng ở 2+ màn thì đưa lên `common`, đừng copy sang cả `admin` lẫn `manager`.

## Thêm key

1. Thêm vào `src/i18n/locales/vi/<ns>.json` **và** `src/i18n/locales/en/<ns>.json`, cùng vị trí,
   cùng cấu trúc lồng nhau.
2. Giữ thứ tự key giống nhau giữa hai file để diff dễ đọc.
3. Placeholder giữ nguyên tên ở cả hai bản: `"greeting": "Chào {{name}}"` / `"Hi {{name}}"`.
   Thiếu/khác tên placeholder ở một bản là lỗi runtime hiện chuỗi thô.
4. Trong page: `const { t } = useTranslation("admin")`, cần chuỗi chung thì thêm
   `const { t: tc } = useTranslation("common")`.
5. Chạy lại script kiểm tra.

## Đổi tên / xoá key

Grep trước khi xoá — key có thể được ghép động:

```bash
rg "stations\.(loadFailed|saveSuccess)" src
rg "t\(`" src   # tìm key nội suy động, script parity không bắt được
```

Đổi tên phải sửa đồng thời: file `vi`, file `en`, và mọi call site.

## Namespace mới

Hiếm khi cần. Nếu thật sự cần thì phải sửa `src/i18n/index.ts` (import, `resources`, mảng `ns`),
thêm cả hai file locale, **và** thêm tên namespace vào `NAMESPACES` trong `check-i18n.mjs`.

## Lưu ý khi test

`src/test/setup.ts` import `../i18n` nên i18n khởi tạo thật trong test. Nhưng phần lớn page test
mock `react-i18next` để `t` trả về chính key — nên **test không phát hiện key thiếu**.
Chỉ script trên mới bắt được. Chạy nó trước khi commit thay đổi có đụng chuỗi.

## Checklist

- [ ] Key có mặt ở cả `vi/` và `en/`, cùng đường dẫn lồng
- [ ] Đúng namespace (chuỗi dùng chung → `common`)
- [ ] Placeholder `{{...}}` trùng tên hai bản
- [ ] Không còn chuỗi hardcode trong page
- [ ] `node .claude/skills/i18n-sync/check-i18n.mjs` xanh
