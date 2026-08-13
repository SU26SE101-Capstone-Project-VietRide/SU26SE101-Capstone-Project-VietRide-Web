# BE gap: `POST /v1/rag/chat` trả 504 Gateway Timeout trên production

Ngày đối soát: 2026-08-12 (Asia/Bangkok)
Môi trường: `https://vietride.online` (FE) → Cloudflare Tunnel → nginx → gateway → rag
Repo BE đã đọc: `SU26SE101-Capstone-Project-VietRide-BE`, branch `master`
Phạm vi: FE chỉ chẩn đoán và lập báo cáo, **không** chỉnh sửa source BE.
Liên quan: [FE-REPORT-rag-be-provider-ingest-2026-08-11.md](FE-REPORT-rag-be-provider-ingest-2026-08-11.md)
(ingest đã chạy được — chat hiện trả kèm `5 nguồn`, nên gap này là vấn đề mới, không phải tồn đọng cũ).

## 1. Kết luận ngắn

`POST /v1/rag/chat` bị **504 Gateway Timeout** ở tầng origin, không phải lỗi FE và cũng
không phải timeout của Cloudflare edge.

1. **Endpoint SSE nhưng header chỉ được flush sau khi toàn bộ pipeline chuẩn bị chạy xong.**
   `ChatController.create` `await prepareChat(...)` rồi mới `flushHeaders()`, nên trong suốt
   giai đoạn intent → rewrite → embedding → retrieval → rerank, **không một byte nào** được
   ghi ra socket.
2. **nginx cắt kết nối ở 60s.** `location /v1/` trong `nginx.prod.conf` chỉ có `proxy_pass`,
   không set `proxy_read_timeout` và không tắt `proxy_buffering`, nên ăn mặc định 60s.
3. **Budget timeout của các bước chuẩn bị vượt xa 60s.** `RAG_PROVIDER_TIMEOUT_MS` mặc định
   30s và có thể tiêu tới ~60s cho một lần `complete()` do cơ chế `refresh()`; ba lần gọi
   OpenRouter tuần tự là đủ để chạm trần nginx.
4. **`docker-compose.prod.yml` không truyền các cờ RAG,** nên production đang chạy toàn bộ
   feature flag ở giá trị mặc định `true` và không thể tinh chỉnh nếu không sửa compose.
5. FE không có lỗi chức năng. Chỉ còn một lỗi UX phụ (bong bóng trả lời rỗng khi stream chết),
   FE sẽ tự xử lý.

## 2. Bằng chứng live

Request lỗi, đọc từ DevTools Network:

| Trường | Giá trị |
|---|---|
| Request URL | `https://vietride.online/v1/rag/chat` |
| Method | `POST` |
| Status | **504 Gateway Timeout** |
| Content-Type | `text/html; charset=UTF-8` (không phải `text/event-stream`) |
| Content-Length | `6452` — trang lỗi HTML của Cloudflare |
| Date | `Wed, 12 Aug 2026 05:07:22 GMT` (12:07:22 ICT) |
| Cf-Ray | `a29cf3476c751a58-SIN` |
| Retry-After | `120` |
| Server | `cloudflare` |

Request payload:

```json
{
  "message": "chính sách đổi trả trong nhà xe",
  "conversationId": "f7dc4ad1-563a-4e00-9dac-49c0df34f47d"
}
```

Nội dung trang lỗi (tab Preview) chỉ đích danh phía origin:

```text
Gateway time-out — Error code 504
Browser: Working
Cloudflare (Singapore): Working
Host (vietride.online): Error
```

Hai điểm cần nhấn mạnh:

- Cloudflare tự báo edge **Working**, chỉ `Host` là **Error** → 504 sinh ra ở origin.
- Nếu là timeout ~100s của chính Cloudflare edge thì mã sẽ là **524**, không phải 504.
- Response là HTML → **header 200/`text/event-stream` của BE chưa bao giờ ra tới nginx**.
  Nếu BE đã kịp `flushHeaders()` thì nginx đã forward header 200 đi rồi và không thể thay
  bằng trang 504 nữa. Vậy timeout xảy ra **bên trong `prepareChat`**, chưa tới bước stream token.

Waterfall trong DevTools cho thấy request treo trên 60s trước khi trả về, trong khi các
request `notifications?page…` chạy song song vẫn trả bình thường → không phải mất mạng client.

## 3. Đối soát source BE

### 3.1 Header SSE bị flush quá muộn — `apps/rag/src/chat/chat.controller.ts:66-77`

```ts
const prepared = await this.chatService.prepareChat(dto, req.user);   // ← toàn bộ chi phí nằm ở đây
response.status(200);
response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
response.setHeader('Cache-Control', 'no-cache, no-transform');
response.setHeader('Connection', 'keep-alive');
response.flushHeaders?.();                                            // ← mới bắt đầu ghi byte đầu tiên

for await (const event of this.chatService.streamPrepared(prepared)) {
  response.write(this.formatSseEvent(event));
}
```

Lưu ý `chatProvider.stream()` là async generator nên body chưa chạy khi `prepareChat` return —
tức là chi phí gọi OpenRouter chat completion nằm **sau** `flushHeaders()` và không phải thủ phạm.
Thủ phạm là các bước đồng bộ **trước** đó.

### 3.2 Chuỗi bước tuần tự trong `prepareChat` — `apps/rag/src/chat/chat.service.ts:61-143`

| # | Bước | Vị trí | Trần thời gian |
|---|---|---|---|
| 1 | `runtimeConfig.getSnapshot()` | `chat.service.ts:74` | Redis/DB, ms |
| 2 | `rateLimit.assertAllowed()` | `chat.service.ts:76` | Redis, ms |
| 3 | `resolveConversation` + `findRecentMessages` + `createUserMessage` | `chat.service.ts:77-86` | 3 round-trip Postgres |
| 4 | **intent classify (LLM)** | `chat.service.ts:88-100` → `chat-intent.service.ts:36` | `RAG_PROVIDER_TIMEOUT_MS` |
| 5 | **query rewrite (LLM)** | `chat.service.ts:102-109` → `chat-query-rewrite.service.ts:30` | `RAG_PROVIDER_TIMEOUT_MS` |
| 6 | **embedding câu hỏi (LLM)** | `chat.service.ts:110` → `openrouter-embedding.provider.ts:23` | `RAG_PROVIDER_TIMEOUT_MS` |
| 7 | hybrid search pgvector | `chat.service.ts:112-122` | tuỳ index |
| 8 | rerank (LLM) | `chat.service.ts:123-125` | có cap 2s — `chat.constants.ts:10` |

Bước 4 và 5 là điều kiện (`isAmbiguous` / `needsRewrite`), bước 6 **luôn chạy** nếu Redis chưa
cache câu hỏi đó. Riêng bước 8 đã được cap 2s đúng cách — nên lấy đó làm mẫu cho 4/5/6.

### 3.3 Trần timeout thực tế cao hơn 30s — `openrouter-chat-completion.provider.ts:186-213`

```ts
const refresh = () => {
  if (controller.signal.aborted) return;
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => { timedOut = true; controller.abort(); },
    this.env.RAG_PROVIDER_TIMEOUT_MS);
};
```

`refresh()` là idle-timeout, không phải deadline tổng. Trong `complete()`
(`openrouter-chat-completion.provider.ts:39-44`) nó được gọi lại ngay sau khi có `Response`
và trước `await response.json()`, nên một lần `complete()` có thể tốn tới **2 × 30s = 60s**.
Chỉ cần bước 4 hoặc 5 rơi vào trạng thái này là đã chạm trần nginx trước khi tới bước 6.

`RAG_PROVIDER_TIMEOUT_MS` mặc định `30_000` tại `apps/rag/src/config/env.schema.ts:33`
(báo cáo 11-08 còn ghi nhận `10000` — việc nâng lên 30s là thay đổi đẩy tổng thời gian vượt
ngưỡng nginx).

### 3.4 nginx `/v1/` dùng toàn bộ giá trị mặc định — `infra/nginx/nginx.prod.conf:52-55`

```nginx
location /v1/ {
  set $gateway http://gateway:3000;
  proxy_pass $gateway;
}
```

Block `http {}` (`nginx.prod.conf:22-39`) cũng không khai `proxy_read_timeout` /
`proxy_buffering`. Vì vậy `/v1/rag/chat` đang chạy với:

- `proxy_read_timeout 60s` (mặc định) → không có byte nào trong 60s là **504**;
- `proxy_buffering on` (mặc định) → kể cả khi chạy được, token SSE bị nginx gom buffer,
  chat không nhỏ giọt real-time đúng nghĩa;
- `proxy_http_version 1.0` (mặc định) → không giữ được streaming ổn định qua upstream.

Đối chiếu: hai block WebSocket ngay bên dưới đã được cấp `proxy_read_timeout 86400s`
(`nginx.prod.conf:100-101` và `117-118`). Route SSE bị bỏ sót vì nó nằm chung trong `/v1/`
và trông giống REST.

### 3.5 Production không truyền cờ RAG — `infra/docker/docker-compose.prod.yml:450-472`

Service `rag` chỉ truyền `OPENROUTER_*`, `CLOUDINARY_*`, DB/Redis/Rabbit. **Không** truyền:

- `RAG_PROVIDER_TIMEOUT_MS`
- `INTENT_FILTER_ENABLED`, `QUERY_REWRITE_ENABLED`, `RERANK_ENABLED`, `SUMMARIZE_ENABLED`, `HYBRID_SEARCH_ENABLED`
- `RAG_INGEST_WORKER_ENABLED`

Tất cả rơi về default trong `env.schema.ts:33` và `env.schema.ts:39-45` — nghĩa là mọi feature
flag đang bật, và **không thể tắt/hạ timeout ở production nếu không sửa compose + redeploy.**

### 3.6 Model `:free` là biến số không kiểm soát được

`env.schema.ts:25-26` và `docker-compose.prod.yml:463-464` đặt mặc định:

```
nvidia/nemotron-3-ultra-550b-a55b:free
nvidia/llama-nemotron-embed-vl-1b-v2:free
```

Free tier OpenRouter không có SLA về latency, có thể xếp hàng hàng chục giây hoặc 429.
Đây là nguyên nhân gần nhất khiến các bước 4/5/6 chạm trần timeout, và cũng khớp với
`RAG_PROVIDER_UNAVAILABLE` đã ghi nhận ngày 11-08.

### 3.7 Trần cứng 100s của Cloudflare

Cloudflare (gói free) giới hạn ~100s cho một request chưa có response. Kể cả khi nới nginx
lên 300s, nếu byte đầu tiên không ra trong ~100s thì sẽ đổi từ 504 sang **524**. Vì vậy
riêng việc nới timeout nginx là **chưa đủ** — bắt buộc phải flush sớm (xem P0 bên dưới).

## 4. Đối soát FE

FE không gây ra lỗi này:

- `src/api/vietride.ts:5327` `streamRagChat` gọi đúng `apiSseRequest` với method/payload đúng hợp đồng.
- `src/api/client.ts:293-296` thấy `!response.ok` → parse body → throw `ApiRequestError` kèm status 504.
  Với body là HTML của Cloudflare thì không có `code`/`message` để bóc, nên FE rơi về thông báo chung.
- `src/pages/RagAssistant.tsx:120-125` bắt lỗi và hiển thị toast.

Lỗi UX phụ **thuộc FE, FE tự xử lý, không cần BE làm gì**: khi stream chết trước khi có token,
bong bóng assistant rỗng (hiển thị `-`) vẫn nằm lại trong khung chat.

## 5. Đề nghị team BE xử lý

### P0 — flush header + heartbeat trước khi chạy pipeline

Đây là fix bắt buộc, vì nó xử lý cả trần 60s của nginx lẫn trần 100s của Cloudflare.
Trong `ChatController.create`, ghi header và một SSE comment **ngay khi vào handler**,
trước `prepareChat`:

```ts
response.status(200);
response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
response.setHeader('Cache-Control', 'no-cache, no-transform');
response.setHeader('X-Accel-Buffering', 'no');   // nginx: tắt buffering cho riêng response này
response.setHeader('Connection', 'keep-alive');
response.flushHeaders?.();
response.write(': ping\n\n');                    // SSE comment — client bỏ qua, nhưng reset đồng hồ proxy
```

Kèm theo một `setInterval` ghi `: ping\n\n` mỗi ~15s trong lúc `prepareChat` chạy, clear ở
`finally`.

**Lưu ý bắt buộc:** sau khi header đã gửi thì không set status code được nữa. Mọi exception
của `prepareChat` (403 `INSUFFICIENT_ROLE`, 404 `RAG_CONVERSATION_NOT_FOUND`, 429
`RAG_RATE_LIMIT_EXCEEDED`, 503 …) phải được chuyển thành `event: error` với đúng `code`
rồi `response.end()`. FE đã xử lý được SSE `error` (`RagAssistant.tsx:71-73` ghi chú rõ điều
này), nên thay đổi này **không phá FE** — nhưng cần BE báo trước để FE đối soát lại mapping
mã lỗi sang toast.

Nếu BE muốn giữ HTTP status thật cho các lỗi rẻ tiền, có thể tách: validate/authz/rate-limit
chạy trước khi flush (đều là Redis/DB, dưới 1s), rồi mới flush header và chạy phần LLM.
Đây là phương án FE ưu tiên vì giữ nguyên contract hiện tại.

### P0 — tách route SSE trong nginx

`infra/nginx/nginx.prod.conf`, đặt **trước** `location /v1/`:

```nginx
location /v1/rag/chat {
  set $gateway http://gateway:3000;
  proxy_pass $gateway;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  chunked_transfer_encoding on;
}
```

Cần kiểm tra thêm gateway (`http-proxy-middleware`, `apps/gateway/src/proxy/proxy.middleware.ts:192-235`)
có buffer response hay không — nếu có thì fix nginx vẫn chưa đủ.

### P1 — siết budget thời gian của các bước chuẩn bị

- Cấp deadline riêng, ngắn, cho intent classify / query rewrite / embedding — lấy mẫu
  `RAG_RERANK_TIMEOUT_MS = 2000` (`chat.constants.ts:10`). Đề xuất 5–8s, fail-open như
  intent/rewrite đang làm sẵn.
- Đổi `refresh()` trong `createAbortContext` thành deadline tổng cho `complete()`, giữ
  idle-timeout chỉ cho `stream()`.
- Chạy song song intent classify với embedding (hai bước độc lập nhau) thay vì tuần tự.

### P1 — truyền cờ RAG vào production compose

Thêm vào service `rag` trong `docker-compose.prod.yml` để prod tinh chỉnh được mà không phải sửa code:

```yaml
RAG_PROVIDER_TIMEOUT_MS: ${RAG_PROVIDER_TIMEOUT_MS:-15000}
INTENT_FILTER_ENABLED: ${INTENT_FILTER_ENABLED:-true}
QUERY_REWRITE_ENABLED: ${QUERY_REWRITE_ENABLED:-true}
RERANK_ENABLED: ${RERANK_ENABLED:-true}
SUMMARIZE_ENABLED: ${SUMMARIZE_ENABLED:-true}
HYBRID_SEARCH_ENABLED: ${HYBRID_SEARCH_ENABLED:-true}
RAG_INGEST_WORKER_ENABLED: ${RAG_INGEST_WORKER_ENABLED:-true}
```

Khai báo tương ứng trong `.env.example`.

### P1 — thoát khỏi model `:free`

Free tier là nguồn latency không kiểm soát được. Đề nghị chuyển `OPENROUTER_CHAT_MODEL` sang
model có SLA, hoặc bật `OPENROUTER_ALLOW_PAID_FALLBACK` với hạn mức, ít nhất cho các bước
phụ (intent/rewrite/rerank) vốn cần nhanh hơn là cần thông minh.

### P2 — observability

- Log thời gian từng bước trong `prepareChat` (intent/rewrite/embed/search/rerank) để lần sau
  không phải suy luận từ trang 504.
- Thêm metric `rag_chat_time_to_first_byte` và alert khi p95 > 20s.
- Thêm alert cho tỷ lệ 504/524 trên `/v1/rag/chat`.

## 6. Cách tái hiện và xác nhận trên server

```bash
docker compose -f infra/docker/docker-compose.prod.yml logs --since 30m nginx | grep "rag/chat"
```

```bash
docker compose -f infra/docker/docker-compose.prod.yml logs --since 30m rag | grep -i "openrouter\|timeout\|upstreamStatus"
```

Nếu nginx log `upstream timed out (110: Connection timed out) while reading response header`
thì chẩn đoán ở mục 3.4 được xác nhận.

## 7. Acceptance criteria

1. `POST /v1/rag/chat` trả header `200` + `Content-Type: text/event-stream` trong **dưới 2s**
   kể từ lúc nhận request, kể cả khi OpenRouter đang chậm.
2. Không còn 504/524 trên `/v1/rag/chat` với câu hỏi bình thường; trường hợp provider thật sự
   chết thì trả SSE `event: error` có `code` cụ thể, không phải trang HTML.
3. Token SSE tới FE nhỏ giọt (không dồn cục ở cuối) — xác nhận bằng DevTools hoặc
   `curl -N https://vietride.online/v1/rag/chat`.
4. Các lỗi 403/404/429 của `prepareChat` vẫn phân biệt được ở FE, dù qua HTTP status hay qua
   SSE `event: error`. Nếu BE đổi sang SSE, báo FE trước để cập nhật mapping toast.
5. Thời gian tới token đầu tiên (TTFT) p95 dưới 20s với câu hỏi đã có tài liệu trong KB.
6. Production đọc được các cờ RAG từ env mà không cần rebuild image.
