---
name: verify
description: Chạy đúng pipeline CI của VietRide (typecheck → lint → test → build) và fix tới khi xanh. Dùng trước khi commit, push, mở PR, hoặc khi cần khẳng định thay đổi không làm vỡ gì. Cũng dùng khi CI đỏ và cần tái hiện lỗi ở máy local.
---

# Verify trước khi commit

`.github/workflows/ci.yml` chạy 4 bước theo đúng thứ tự này trên mọi push vào `main`/`develop`
và mọi PR vào `main`. Chạy thiếu bước nào là để lỗi lọt lên CI.

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint .
npm test            # vitest run
npm run build       # tsc -b && vite build
```

**Chạy tuần tự, dừng ở bước đỏ đầu tiên, fix, rồi chạy lại từ bước đó.** Không chạy song song —
`tsc -b` và `vite build` dùng chung buildinfo cache.

## Vì sao đủ 4 bước

| Bước | Bắt được lỗi mà bước khác không bắt |
|---|---|
| typecheck | Sai type xuyên file (`vietride.ts` → page) |
| lint | `react-hooks/exhaustive-deps`, biến thừa, `react-refresh` |
| test | Regression hành vi: URL API, mapping field, render + interaction |
| build | **Import sai hoa/thường** (Linux phân biệt, Windows thì không), env thiếu, tree-shaking vỡ |

Bước `build` là bước hay bị bỏ nhất và là bước duy nhất tái hiện được lỗi case-sensitive —
máy dev chạy Windows nên `import Modal from "./modal"` vẫn chạy local mà đỏ trên CI.

## Khi đỏ

1. **Đọc lỗi đầu tiên, sửa đúng nguyên nhân gốc.** Không nới type, không `// eslint-disable`,
   không `skip` test để cho qua. Nếu buộc phải disable thì ghi rõ lý do ngay dòng trên.
2. **Lỗi có sẵn từ trước, không do thay đổi hiện tại**: đừng gộp vào scope. Báo chính xác lệnh +
   output, hỏi có xử lý riêng không.
3. **Test fail vì URL**: `VITE_API_BASE_URL` được pin trong `vitest.config.ts`
   (`https://api.vietride.online`), test **không** đọc `.env`. Đổi assert sang relative path là sai hướng.
4. **`npm ci` fail**: kiểm tra `.npmrc` còn dòng `legacy-peer-deps=true` không —
   `@react-three/drei@9` khai peer `react@18` trong khi project chạy `react@19`.

## Chạy nhanh khi lặp

Trong lúc sửa, thu hẹp phạm vi cho nhanh:

```bash
npx vitest run src/api/vietride.test.ts        # một file test
npx eslint src/pages/Admin/Stations/index.tsx  # một file
```

Nhưng **trước khi báo xong, phải chạy lại đủ 4 lệnh full ở trên.**

## Báo cáo

Khi xong, báo dạng:

```
typecheck ✅  lint ✅  test ✅ (N files, M tests)  build ✅
```

Bước nào không chạy được (giới hạn môi trường, sandbox) thì nói thẳng bước đó bị skip và vì sao —
tuyệt đối không tuyên bố "đã verify" khi chưa chạy đủ.
