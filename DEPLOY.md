# Deploy VietRide Operator Web

Chọn **phương án B** trong [`FE_INTEGRATION_AND_DEPLOYMENT.md`](FE_INTEGRATION_AND_DEPLOYMENT.md) §10.2:
FE chạy như một container cùng server BE, nginx của BE proxy `location /` vào nó.

Hệ quả quan trọng: **FE và API cùng origin** (`https://vietride.online`), nên
client gọi API bằng path tương đối. Không có CORS preflight, và `TRACKING_CORS_ORIGIN`
chưa cần đụng tới (FE hiện chưa dùng socket — `socket.io-client` chưa có trong deps).

---

## 1. Kiến trúc sau khi deploy

```
vietride.online  ─┐                    ┌── /v1/                  → gateway:3000
                  │                    ├── /docs, /api-specs/    → gateway:3000
                  ├→ cloudflared ─→ nginx ── /.well-known/       → gateway:3000  (App Links)
                  │     tunnel         ├── = /auth/set-password  → gateway:3000  (mở app)
api.vietride.online ─┘                 ├── /tracking/socket.io/  → tracking:3001
                                       ├── /health               → nginx trả 'ok'
                                       └── /                     → frontend:80   ← MỚI
```

nginx dùng `server_name _` (một server block bắt mọi hostname), nên cả apex lẫn
`api.` đi vào cùng bảng route này. `location /` là block khớp lỏng nhất, mọi route
BE ở trên đều thắng nó — FE không nuốt mất route nào.

Hai dòng in đậm về deep-link là lý do **đổi apex sang nginx không làm gãy App Links**:
chúng khớp cụ thể hơn `location /` nên vẫn về gateway y như khi apex trỏ thẳng vào
gateway.

---

## 2. Thay đổi ở repo BE — ĐÃ THỰC HIỆN

Hai file dưới đây đã được sửa sẵn trong repo BE, chỉ cần review rồi commit.

### 2.1 `infra/docker/docker-compose.prod.yml` — KHÔNG thêm service `frontend`

FE chạy như một **compose project riêng** (`vietride-frontend`), file compose nằm
trong repo FE (`docker-compose.prod.yml` ở root), gắn vào network `vietride_net` mà
stack BE tạo ra.

Đặt `frontend` vào compose của BE sẽ buộc hai deploy dính nhau **cả hai chiều**:

| Nếu để chung | Hậu quả |
|---|---|
| BE chạy `docker compose pull` (mọi service) | image FE hỏng/chưa có → **sập một lần deploy BE hoàn toàn không liên quan** |
| BE chạy `up -d --remove-orphans` | có thể recreate hoặc xoá container FE ngoài ý muốn |

Tách project ra thì deploy BE không bao giờ chạm FE và ngược lại. Trong compose BE
chỉ còn một khối comment giải thích vì sao `frontend` không nằm ở đó.

> ⚠️ File compose của FE **bắt buộc** khai `aliases: [frontend]` trên network.
> Container thuộc project khác nên không tự có alias theo tên service trên network
> external — thiếu dòng đó thì nginx resolve `frontend` không ra và trả 502.

### 2.2 `infra/nginx/nginx.prod.conf` — thay placeholder `location /`

Dùng đúng pattern `resolver` + biến mà `$gateway` / `$tracking` đang dùng:

```nginx
    location / {
      set $frontend http://frontend:80;
      proxy_pass $frontend;
    }
```

Biến là **bắt buộc**, không phải cho đẹp: FE deploy độc lập nên IP container đổi sau
mỗi lần release. Viết `proxy_pass http://frontend:80;` cứng sẽ resolve một lần lúc
nginx khởi động rồi 502 sau mỗi lần deploy FE cho tới khi restart nginx.

Các header proxy (`Host`, `X-Real-IP`, `X-Forwarded-*`) đã khai báo ở scope `http {}`
nên không cần lặp lại trong block này.

> ⚠️ File này là bind-mount. Compose **không recreate container khi chỉ đổi nội dung
> bind-mount** (đúng bẫy §10.4-6). Workflow deploy của BE đã xử lý sẵn: nó chạy
> `nginx -t` rồi `nginx -s reload`, fallback `--force-recreate`. Nên chỉ cần deploy BE
> một lần là config mới có hiệu lực.

### 2.3 Đổi mapping apex trong Cloudflare Zero Trust

FE phục vụ ở **`https://vietride.online`** (apex, không subdomain). Hiện apex đang
được tunnel trỏ **thẳng vào `gateway:3000`, không qua nginx** (xem
`docs/superpowers/specs/2026-07-07-deeplink-infra-design.md` §1, verify bằng curl
2026-07-07). Đổi public hostname của apex thành:

```
vietride.online  →  http://nginx:80
```

**Deep-link không gãy.** nginx đã có sẵn hai block ưu tiên cao hơn `location /`:
`location /.well-known/` và `location = /auth/set-password`, cả hai đều forward sang
gateway. Nên `assetlinks.json` và trang "Mở trong app" vẫn về gateway y như hiện tại;
chỉ những path còn lại mới rơi vào FE. Đã verify bằng thực nghiệm — xem §4.

> ⚠️ Comment ở `nginx.prod.conf:54` ghi *"vietride.online → this nginx via the tunnel"*,
> mâu thuẫn với spec deeplink nói apex trỏ thẳng vào gateway. Mapping thật nằm trong
> Cloudflare dashboard chứ không trong repo — **kiểm tra dashboard trước khi đổi**.

### 2.4 Sửa `/opt/vietride/infra/docker/.env`

```env
VNPAY_RETURN_URL=https://vietride.online/payments/return
PUBLIC_APP_URL=https://vietride.online          # KIỂM TRA, đừng đổi bừa — xem cảnh báo dưới
```

> 🚨 **`PUBLIC_APP_URL` bắt buộc phải là `https://vietride.online`.** Intent filter
> Android khai báo host `vietride.online`, nên link đặt-mật-khẩu trong email phải nằm
> trên chính host đó thì hệ điều hành mới chặn và mở app tài xế. Trỏ sang
> `api.vietride.online` hay bất kỳ subdomain nào khác là **gãy toàn bộ deep-link
> onboarding tài xế** — link vẫn mở nhưng ra web thay vì ra app.

Chưa cần `TRACKING_CORS_ORIGIN` (FE chưa dùng socket). Khi nào FE thêm realtime
thì mới phải đăng ký origin — nhưng vì same-origin nên nhiều khả năng vẫn không cần.

### 2.5 Link đặt mật khẩu trong email — ĐÃ SỬA

Trước đây Identity sinh **một link duy nhất** `/auth/set-password` cho mọi vai trò.
Nhưng hai nhóm cần hai trang đích khác nhau, mà nginx lại route đường đó về gateway:

| Vai trò | Cần trang gì | Trước đây nhận được |
|---|---|---|
| `DRIVER`, `ASSISTANT` | trang "Mở trong app" (gateway) | ✅ đúng |
| `OPERATOR_STAFF`, `OPERATOR_ADMIN`, `SYSTEM_ADMIN` | form web (FE) | ❌ cũng ra trang mở app, không đặt được mật khẩu |

`BuildSetInitialPasswordUrl` giờ nhận thêm tham số `UserRole` và chọn path theo vai trò:

```
DRIVER / ASSISTANT  →  /auth/set-password          (GIỮ NGUYÊN, không đổi 1 ký tự)
còn lại             →  /auth/set-initial-password  (FE đã có sẵn route)
```

> 🔒 `/auth/set-password` là path mà Android App Links đang canh (assetlinks.json +
> intent filter của app driver). **Không được đổi** — đổi là tài xế bấm link ra web
> thay vì mở app. Code gateway không bị đụng tới, deep-link giữ nguyên từng byte.

Đã verify: 281 unit test pass (baseline 269 + 12 test mới), và chạy thật qua nginx thì
`/auth/set-password` → gateway, `/auth/set-initial-password` → FE.

FE **không phải sửa gì** — `App.tsx` đã sẵn route `/auth/set-initial-password`.

### 2.6 Secrets cho GitHub Actions của repo FE

Dùng lại đúng bộ secret BE đang dùng:

| Secret | Giá trị |
|---|---|
| `DEPLOY_HOST` | như BE |
| `DEPLOY_USER` | như BE |
| `DEPLOY_SSH_KEY` | như BE |
| `DEPLOY_PORT` | như BE |
| `GHCR_USERNAME` | như BE |
| `GHCR_TOKEN` | PAT có scope `read:packages` |
| `APP_DOMAIN` | `vietride.online` |
| `VITE_GOOGLE_MAPS_API_KEY` | key Google Maps — nhúng vào bundle **lúc build image** |
| `VITE_GOOGLE_ROUTES_API_KEY` | key Google Routes — nhúng vào bundle **lúc build image** |

Không cần variable `VITE_API_BASE_URL` — để trống là same-origin. Chỉ set nếu sau
này tách FE sang domain khác.

> 🚨 **Không sửa key VITE_\* qua `.env` trên server.** Vite nhúng biến `VITE_*` vào
> bundle JS lúc build trên GitHub Actions; container chỉ là nginx phát file tĩnh nên
> không đọc `.env` lúc runtime. `/opt/vietride/frontend/.env` chỉ chứa `FRONTEND_TAG`
> cho compose. Muốn đổi key → sửa secret trên GitHub rồi chạy lại pipeline build.
> Cấu hình Firebase (public, không phải secret) đã có default ngay trong `Dockerfile`.

---

## 3. Quy trình deploy

**Tự động hoàn toàn**, mirror pipeline của repo BE. Chỉ cần merge vào `main`:

```
push main
   │
   ▼
ci.yml            typecheck + lint + test + build
   │
   ▼  workflow_run (chỉ khi CI PASS)
release.yml       tính semver từ Conventional Commits → push tag vXX
   │
   ├─▶ docker-build.yml   (workflow_call)  build + push GHCR :vXX và :<sha>
   │
   └─▶ deploy.yml         (workflow_call)  scp compose → ssh → pull → up -d
                                           → health check ~150s
```

| Workflow | Trigger |
|---|---|
| `ci.yml` | push `main`/`develop` + mọi PR |
| `release.yml` | **`workflow_run` khi CI hoàn tất trên `main`** |
| `docker-build.yml` | `workflow_call` từ release, hoặc push tag `v*`, hoặc bấm tay |
| `deploy.yml` | `workflow_call` từ release, hoặc bấm tay (đường rollback) |

Vì sao `release.yml` bám vào `workflow_run` chứ không phải `push`: đó là **chốt an
toàn**. CI đỏ thì mọi job phía sau bị skip, không có gì lên production. Và nó checkout
`workflow_run.head_sha` để tag đúng commit CI đã kiểm — giữa lúc CI chạy có thể đã có
commit khác merge vào `main`.

> Tag do `release.yml` đẩy lên bằng `GITHUB_TOKEN` **không** kích hoạt lại
> `docker-build.yml` qua nhánh `push: tags`. GitHub cố tình chặn đệ quy với
> `GITHUB_TOKEN`, nên không bị build hai lần.

**Rollback** = vào Actions → "Deploy frontend" → Run workflow với tag cũ. Không build
lại gì. Đây là lý do bản `workflow_dispatch` vẫn được giữ song song với `workflow_call`.

Workflow deploy nhân đôi bước ssh với `continue-on-error` + retry, giống BE — lý do
là ISP NAT trước server hay reset kết nối SSH từ IP runner GitHub (Azure). Script
idempotent nên chạy lại vô hại. **Đừng bỏ bước retry này.**

---

## 4. Kiểm tra sau deploy

```bash
curl -fsS  https://vietride.online/            # FE index.html
curl -fsS  https://vietride.online/health      # vẫn phải là 'ok' của nginx BE
curl -fsSI https://vietride.online/manager/dashboard   # 200 (SPA fallback), KHÔNG phải 404
curl -fsS  https://vietride.online/v1/ping     # gateway vẫn nguyên, FE không nuốt /v1/
curl -fsS  https://vietride.online/.well-known/assetlinks.json   # deep-link PHẢI còn sống
curl -fsS  https://vietride.online/auth/set-password             # trang mở app PHẢI còn sống
curl -fsSI https://vietride.online/docs        # Swagger vẫn truy cập được
```

Năm lệnh cuối là để chắc `location /` không cướp mất route của BE. Hai lệnh deep-link
quan trọng nhất — nếu `assetlinks.json` không trả JSON thuần 200 thì Android sẽ ngừng
verify App Links và toàn bộ deep-link tài xế hỏng.

### Đã verify trước khi bàn giao

Chạy local bằng chính `nginx.prod.conf` thật + FE image thật + gateway giả:

| Kiểm tra | Kết quả |
|---|---|
| `nginx -t` trên `nginx.prod.conf` (image nginx:1.27-alpine) | syntax OK |
| `/health`, `/v1/*`, `/docs`, `/api-specs/*`, `/.well-known/*` | vẫn về gateway, FE không nuốt |
| `/`, `/manager/dashboard`, `/admin/users`, `/payments/return?vnp_*` | 200 + `index.html` (SPA fallback qua 2 lớp nginx) |
| `/assets/<file-không-tồn-tại>.js` | 404, **không** fallback về index.html |
| Cache header | `/assets/*` → `immutable, max-age=1y`; `/` → `no-cache` |
| Bundle không chứa host tuyệt đối | 0 lần → gọi API bằng relative path |
| **Tắt container `frontend`** | `/` → 502 nhưng `/v1/*` và `/health` vẫn 200 — API không chết theo FE |
| **Xoá + tạo lại `frontend` (IP mới)** | `/` tự hồi phục 200 sau ~10s **mà không cần restart nginx** — đúng như thiết kế `resolver` + biến |

### Hai repo có thực sự độc lập không

Dựng lại bằng chính `nginx.prod.conf` và `docker-compose.prod.yml` thật:

| Kịch bản | Kết quả |
|---|---|
| Deploy BE khi **chưa có image FE nào** | ✅ chạy trót lọt; `/v1/` 200, chỉ `/` là 502 |
| Deploy FE sau đó | ✅ `/` 200, nginx resolve được qua alias |
| **BE deploy lại với `--remove-orphans`** | ✅ container FE **không bị xoá** (khác project) |
| **FE deploy lại (IP mới), nginx không restart** | ✅ tự hồi phục, BE không hề bị ảnh hưởng |
| **Gỡ hẳn FE** | ✅ `/` → 502 nhưng `/v1/` và `/health` vẫn 200 |

→ Không còn ràng buộc thứ tự. Deploy bên nào trước cũng được, trừ đúng một điều kiện:
network `vietride_net` phải tồn tại (do BE tạo lần đầu). Workflow FE kiểm tra điều này
và báo lỗi rõ ràng nếu thiếu.

### Kịch bản apex — deep-link có gãy không

Dựng lại đúng trạng thái sau khi đổi tunnel (`vietride.online` → `nginx:80`), với
gateway giả trả đúng nội dung deep-link thật:

| Đường | Về đâu | Kết quả |
|---|---|---|
| `/.well-known/assetlinks.json` | gateway | **200, `application/json`, 0 redirect** — thoả đúng yêu cầu Android App Links |
| `/auth/set-password?token=…` | gateway | 200, trang "Mở trong app" nguyên vẹn |
| `/`, `/login`, `/admin/dashboard`, `/manager/trips` | frontend | 200 + SPA |
| `/v1/auth/login`, `/health` | gateway / nginx | nguyên vẹn |

→ Chuyển apex sang nginx **không đụng gì tới deep-link**. Không cần sửa gateway,
không cần sửa FE, không cần di dời `.well-known` như checklist trong spec deeplink
(mục đó viết khi chưa có mấy block `location` này trong nginx).

---

## 5. Những chỗ còn nợ / cần biết

| # | Việc | Ghi chú |
|---|---|---|
| 0 | **Import phân biệt hoa/thường** | `Sidebar.tsx` từng import `../assets/login/logo.svg` trong khi thư mục thật là `assets/Login/`. Windows bỏ qua khác biệt hoa thường nên build local vẫn xanh, còn Docker/CI chạy Linux thì **fail build**. Đã sửa. Lỗi này chỉ lộ ra khi build trên Linux — đừng tin `npm run build` trên máy Windows là đủ. |
| 1 | `.npmrc` đặt `legacy-peer-deps=true` | `@react-three/drei@9` peer-require react 18, project dùng react 19. Bỏ dòng này là `npm ci` fail. Nợ kỹ thuật: nên nâng drei lên v10. |
| 2 | Bundle 1 chunk 1.57 MB (410 KB gzip) | Chạy được nhưng first load chậm. Nên code-split route admin/manager và lazy-load `vehicle-builder` (three.js). |
| 3 | Ảnh login ~4.6 MB chưa nén | `src/assets/Login/*.png`. Convert sang WebP là giảm ~80%. |
| 4 | ~~`.env` đang được commit~~ **đã xử lý** | `.gitignore` giờ chặn `.env` + `.env.*` (trừ `.env.example`). Test **không còn phụ thuộc** vào `.env`: `vitest.config.ts` tự pin `VITE_API_BASE_URL`, nếu không thì CI (clone sạch, không có `.env`) sẽ đỏ 29 assertion. Dev copy `.env.example` → `.env`. |
| 5 | `/payments/return` nằm sau `PrivateRoute` role `OPERATOR_ADMIN` | Nếu session hết hạn lúc VNPay redirect về, user bị đá sang `/login` và mất query `vnp_*`. Cân nhắc cho route này public, chỉ hiển thị rồi poll `GET /v1/operator/wallet`. |
| 6 | FE chiếm apex `vietride.online/` | Cần đổi mapping tunnel apex sang `nginx:80` (§2.3). `api.vietride.online` vẫn dành riêng cho API. Deep-link đã verify là không gãy. |
| 7 | Chưa có realtime | `socket.io-client` chưa có trong deps, chưa có code tracking. Trang `manager/gps` hiện không nhận GPS realtime. |
