# FE → BE handoff: RAG ingest bị treo và chat provider unavailable

Ngày đối soát: 2026-08-11 (Asia/Bangkok)  
Môi trường: `https://api.vietride.online`  
BE source đã đọc: branch `main`, commit `59d51c17`  
Phạm vi: chỉ chẩn đoán và lập báo cáo; FE không chỉnh sửa source BE.

## 1. Kết luận ngắn

Lỗi chức năng chính nằm ở BE/deployment, không phải payload hoặc SSE parser của FE.

1. **Document ingest không chạy:** production compose không truyền `RAG_INGEST_WORKER_ENABLED`; schema mặc định `false`, nên worker thoát ngay khi khởi động. Document được tạo `APPROVED/PENDING` và có outbox event nhưng không được chunk/embed.
2. **Chat provider không dùng được:** live API trả SSE `RAG_PROVIDER_UNAVAILABLE` cho cả câu hỏi trong phạm vi và ngoài phạm vi. Request đã qua bước prepare/retrieval; lỗi xảy ra khi stream OpenRouter chat completion.
3. **Không đủ observability để biết nguyên nhân upstream chính xác:** BE bỏ status/body upstream (ngoại trừ 429) và `ChatService` gom mọi lỗi stream thành `RAG_PROVIDER_UNAVAILABLE`. Cần kiểm tra production key/quota/model routing/timeout trong log hoặc bổ sung log an toàn.
4. **FE có lỗi UX phụ:** FE nhận được mã lỗi SSE nhưng sau đó ghi đè bằng thông báo chung. Lỗi này không gây hỏng provider/ingest, chỉ che thông tin lỗi với người dùng.

## 2. Bằng chứng live

### 2.1 Upload document

Ba document được tạo thành công bằng token `SYSTEM_ADMIN`:

| Document | ID | Status | Ingest |
|---|---|---|---|
| `[Mẫu] FAQ đặt vé và thanh toán VietRide` | `b67689e1-4c57-48f7-a519-0ba191237c71` | `APPROVED` | `PENDING` |
| `[Mẫu] Hướng dẫn vận hành dành cho nhà xe` | `3a8e8079-f04d-4daf-a82a-be35afcf4afc` | `APPROVED` | `PENDING` |
| `[Mẫu] Quy trình kiểm duyệt nội dung AI` | `42682ead-75ee-4a66-9e7c-44fd763e3417` | `APPROVED` | `PENDING` |

Sau nhiều lần gọi `GET /v1/rag/documents?page=1&pageSize=100`, cả ba vẫn giữ `ingestStatus=PENDING`.

Gọi `PUT /v1/rag/documents/{id}/approve` trả:

```json
{
  "code": "RAG_DOCUMENT_STATUS_CONFLICT",
  "message": "Document ... is not pending review"
}
```

Đây **không phải lỗi**: POST upload hiện tự approve cho `SYSTEM_ADMIN`.

### 2.2 Chat

Đã thử tối thiểu hai loại câu hỏi:

- Trong phạm vi: `Theo tài liệu mẫu, hành khách cần lưu ý gì trước khi thanh toán đặt vé?`
- Ngoài phạm vi: `Hãy viết thơ về bóng đá.`

Cả hai trả HTTP 200 với SSE:

```text
event: error
data: {"code":"RAG_PROVIDER_UNAVAILABLE","message":"RAG chat provider is unavailable"}
```

Không có event `done`, do đó không có `assistantMessageId`; API feedback không thể tạo dữ liệu audit hợp lệ. `GET /v1/rag/feedback` vẫn có `totalItems=0`.

## 3. Đối soát source BE

### 3.1 Worker ingest bị tắt bởi deployment config

- `apps/rag/src/config/env.schema.ts:39`:

```ts
RAG_INGEST_WORKER_ENABLED: booleanEnvSchema.default(false)
```

- `apps/rag/src/ingest/ingest-worker.service.ts:22-27`:

```ts
onModuleInit(): void {
  if (!this.env.RAG_INGEST_WORKER_ENABLED) return;
  // timer + initial tick
}
```

- `infra/docker/docker-compose.prod.yml:438-477` khai báo service `rag` nhưng **không truyền** `RAG_INGEST_WORKER_ENABLED`.
- `.env.example` cũng chưa khai báo biến này.

Với production compose hiện tại, giá trị runtime chắc chắn rơi về mặc định `false`.

Trong khi đó luồng upload đã tạo đủ dữ liệu để worker xử lý:

- `apps/rag/src/documents/documents.service.ts:65`: gọi `createApproved(...)`.
- `apps/rag/src/documents/documents.repository.ts:24-38`: tạo document `APPROVED`, `ingestStatus=PENDING` và tạo outbox event trong cùng transaction.
- `apps/rag/src/ingest/ingest-worker.service.ts:39`: worker polling `processPendingOnce(...)` nếu được bật.

Vì vậy chỉ cần bật worker đúng cách, các outbox event `PENDING` hiện có phải được xử lý lại mà không cần upload lại document.

### 3.2 Chat provider lỗi nhưng mất nguyên nhân upstream

- Model mặc định:
  - `.env.example:173`
  - `infra/docker/docker-compose.prod.yml:455`
  - `apps/rag/src/config/env.schema.ts:25`
  - Giá trị: `nvidia/nemotron-3-ultra-550b-a55b:free`
- Đối soát public OpenRouter models tại thời điểm kiểm tra cho thấy model chat này **vẫn tồn tại**. Vì vậy không nên kết luận model đã bị xóa.
- `apps/rag/src/providers/openrouter-chat-completion.provider.ts:70-83`:
  - gọi `/chat/completions`;
  - chỉ tách riêng status `429`;
  - mọi status khác đều chuyển thành `RAG_PROVIDER_UNAVAILABLE`;
  - không giữ upstream status/body/request-id/model trong log.
- `apps/rag/src/chat/chat.service.ts:163-174` tiếp tục bắt mọi lỗi stream và luôn trả cùng mã `RAG_PROVIDER_UNAVAILABLE`.
- `apps/rag/src/chat/chat.service.ts:346-351` chỉ log `{name, status}`, nên log hiện tại không đủ để phân biệt:
  - API key invalid/không có quyền;
  - hết credit hoặc free quota;
  - model/provider route tạm unavailable;
  - payload/model invalid;
  - timeout/network/TLS;
  - lỗi ghi assistant message sau khi stream.

Luồng `prepareChat` đã resolve query embedding trước khi tạo stream. Live request trả SSE error trong lúc stream thay vì HTTP error trước stream, nên embedding/retrieval đã đi qua; lỗi quan sát được nằm ở chat completion stream hoặc bước lưu assistant sau stream.

### 3.3 Readiness/healthcheck không phát hiện chat hỏng

- `apps/rag/src/app/readiness.service.ts:42` chỉ probe embedding provider (`embeddingProbe.probe()`), không probe chat completion.
- `infra/docker/docker-compose.prod.yml:474` dùng `/health`, không dùng `/ready`.

Do đó container có thể được đánh dấu healthy trong khi chat model/provider không hoạt động và worker ingest bị tắt.

### 3.4 Cờ outbox chưa được dùng

`RAG_OUTBOX_PUBLISH_ENABLED` được khai báo tại `apps/rag/src/config/env.schema.ts:40`, nhưng không có runtime usage ngoài schema/test. Hiện ingest hoạt động bằng worker polling trực tiếp bảng outbox. Team BE nên xác nhận ý định: triển khai publisher thật hoặc bỏ cờ để tránh cấu hình gây hiểu nhầm.

## 4. Đối soát FE

FE không gây ra lỗi provider/ingest:

- `src/api/vietride.ts:5051-5100` parse đúng SSE `token`, `done`, `error`.
- `src/pages/RagAssistant.tsx:71-105` gọi đúng `streamRagChat` và nhận `streamEvent.code/message`.

Lỗi FE phụ:

- `src/pages/RagAssistant.tsx:104` set lỗi chi tiết từ SSE.
- `src/pages/RagAssistant.tsx:108-110` ngay sau đó thấy không có `doneEvent` và ghi đè bằng `Trợ lý AI đã dừng trước khi hoàn tất câu trả lời.`

FE nên giữ lại SSE error nếu đã nhận event `error`, nhưng thay đổi này chỉ cải thiện thông báo, không sửa được BE.

## 5. Đề nghị team BE xử lý

### P0/P1 — bật ingest worker trong production

1. Khai báo rõ trong `.env.example`:

```dotenv
RAG_INGEST_WORKER_ENABLED=true
```

2. Truyền biến vào service `rag` trong cả compose phù hợp, ví dụ:

```yaml
RAG_INGEST_WORKER_ENABLED: ${RAG_INGEST_WORKER_ENABLED:-true}
```

Nếu production chạy nhiều replica RAG, xác nhận lock/idempotency hiện tại đủ an toàn hoặc chỉ bật worker trên replica chuyên dụng.

3. Redeploy và xác nhận các outbox event cũ được drain; ba document nêu trên phải chuyển `PENDING → PROCESSING → COMPLETED`.

### P1 — điều tra OpenRouter chat production

Kiểm tra an toàn, không in secret:

- `OPENROUTER_API_KEY` có được set và còn hiệu lực/quota;
- `OPENROUTER_CHAT_MODEL` runtime thực tế;
- container có thể gọi `OPENROUTER_BASE_URL/chat/completions`;
- upstream HTTP status, OpenRouter error code/request-id và thời gian phản hồi;
- timeout hiện tại `RAG_PROVIDER_TIMEOUT_MS=10000` có phù hợp với model free lớn hay không.

Model mặc định vẫn có trong public catalog tại thời điểm đối soát, nhưng endpoint cụ thể vẫn có thể hết capacity/quota hoặc không khả dụng cho API key production.

### P1 — cải thiện error mapping/logging

Trong provider, giữ log an toàn tối thiểu:

- model;
- upstream HTTP status;
- upstream request-id/error code đã sanitize;
- timeout vs network error;
- tuyệt đối không log Authorization header, prompt hoặc token.

Không nên map 400/401/402/403/404/429/5xx thành cùng một lỗi. `ChatService.streamPrepared` cũng không nên biến lỗi lưu DB sau stream thành lỗi provider.

### P2 — readiness/monitoring

- Production orchestrator nên dùng `/ready` thay vì chỉ `/health` khi quyết định nhận traffic.
- Readiness hoặc synthetic monitor cần kiểm tra chat completion, không chỉ embedding.
- Thêm metric/alert cho:
  - số document `PENDING` quá ngưỡng thời gian;
  - ingest worker enabled/last successful tick;
  - tỷ lệ `RAG_PROVIDER_UNAVAILABLE`;
  - upstream status theo nhóm.

## 6. Acceptance criteria

1. Upload một `.md` bằng `SYSTEM_ADMIN` trả `APPROVED/PENDING` và chuyển `COMPLETED` trong thời gian worker SLA.
2. Ba document hiện có chuyển sang `COMPLETED` mà không upload lại.
3. `POST /v1/rag/chat` trả tối thiểu một event `token` và kết thúc bằng event `done` có `assistantMessageId`.
4. `POST /v1/rag/messages/{assistantMessageId}/feedback` thành công; `GET /v1/rag/feedback` hiển thị record.
5. Khi OpenRouter trả 401/402/404/429/5xx hoặc timeout, log BE phân biệt được nguyên nhân mà không lộ secret.
6. Readiness/monitoring báo degraded khi chat provider không dùng được hoặc ingest backlog bị treo.

## 7. Không nằm trong thay đổi này

- FE không sửa source BE.
- Không đổi OpenRouter key/model/config production.
- Không can thiệp database hoặc tạo feedback giả bằng UUID không tồn tại.

