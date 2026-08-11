# Incident API — Hướng dẫn tích hợp Frontend

> Đối chiếu trực tiếp với source trên nhánh hiện tại ngày 2026-08-12. Tài liệu này mô tả hành vi đang có trong code, không phải đề xuất contract mới.

## Mục lục

- [Môi trường và xác thực](#môi-trường-và-xác-thực)
- [Response envelope và quy ước chung](#response-envelope-và-quy-ước-chung)
- [Bảng endpoint](#bảng-endpoint)
- [Flow dành cho Admin/Operator Web](#flow-dành-cho-adminoperator-web)
- [Danh sách sự cố](#1-danh-sách-sự-cố)
- [Chi tiết sự cố](#2-chi-tiết-sự-cố)
- [Đánh dấu sự cố đã xử lý](#3-đánh-dấu-sự-cố-đã-xử-lý)
- [Báo cáo sự cố từ chuyến đi](#4-báo-cáo-sự-cố-từ-chuyến-đi)
- [Xử lý lỗi dùng chung](#xử-lý-lỗi-dùng-chung)
- [Phân công FE](#phân-công-fe)
- [Checklist tích hợp](#checklist-tích-hợp)

## Môi trường và xác thực

| Môi trường | Base URL REST |
|---|---|
| Production | `https://api.vietride.online` |
| Local qua Gateway | `http://localhost:3000` |
| Trip Service trực tiếp, chỉ để debug BE | `http://localhost:5002` |
| Swagger production | `https://api.vietride.online/docs` |

FE luôn gọi qua Gateway. Không gọi `/internal/v1/*` và không tự tạo header `X-Internal-Auth`.

Các endpoint Incident dùng User Access Token RS256:

```http
Authorization: Bearer <accessToken>
```

Token lấy từ `POST /v1/auth/login`:

```json
{
  "email": "admin@operator.vn",
  "password": "your-password"
}
```

`data.accessToken` mặc định hết hạn sau `900` giây. Khi nhận `401`, client chỉ nên refresh một lần bằng `POST /v1/auth/refresh` với `{ "refreshToken": "..." }`, cập nhật token và retry request gốc một lần. Không tạo vòng lặp refresh vô hạn.

Phân quyền:

| Endpoint | Role được phép |
|---|---|
| List/detail incident | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| Resolve incident | chỉ `OPERATOR_ADMIN` |
| Driver report incident | `DRIVER`, `ASSISTANT` được Gateway cho qua; controller Trip kiểm tra role và crew assignment |

Gateway còn kiểm tra `operatorStatus`. Role thuộc operator phải có claim này và giá trị phải là `APPROVED`; nếu không có hoặc operator bị suspend, request bị chặn trước khi đến Trip Service.

## Response envelope và quy ước chung

Thành công:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T14:30:00+07:00"
  }
}
```

Lỗi:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred.",
    "fields": {
      "resolutionNote": ["Resolution note is required."]
    }
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T14:30:00+07:00"
  }
}
```

Quy ước:

- JSON public dùng `camelCase`.
- UUID là chuỗi dạng `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
- Thời gian response public được Gateway chuẩn hóa sang ISO 8601 có offset Việt Nam `+07:00`.
- Query `from`/`to` của incident là ngày `YYYY-MM-DD`, không phải timestamp.
- Gateway rate limit mặc định `120 request / 60 giây / IP / route`. Khi vượt giới hạn trả `429 RATE_LIMITED`.
- Mutation cần `Idempotency-Key` phải là UUID v4 mới. Cùng key + cùng request sẽ replay kết quả; không tạo key mới khi chỉ retry vì timeout/network.

## Bảng endpoint

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/v1/operator/incidents` | Admin/Staff | Danh sách sự cố trong operator hiện tại |
| `GET` | `/v1/operator/incidents/{incidentId}` | Admin/Staff | Chi tiết một sự cố |
| `PATCH` | `/v1/operator/incidents/{incidentId}/resolve` | Admin | Đánh dấu sự cố đã xử lý |
| `POST` | `/v1/driver/trips/{tripId}/incident` | Driver/Assistant đã được phân công | Báo cáo sự cố khi chuyến đang chạy |

## Flow dành cho Admin/Operator Web

1. Mở màn danh sách bằng `GET /v1/operator/incidents?status=OPEN`.
2. Mở chi tiết bằng `GET /v1/operator/incidents/{incidentId}`.
3. Nếu `data.status === "OPEN"` và user hiện tại là `OPERATOR_ADMIN`, hiển thị nút “Đánh dấu đã xử lý”.
4. Gọi `PATCH .../resolve` với UUID v4 idempotency key và note đã trim.
5. Thành công: thay incident trong cache bằng `response.data` hoặc invalidate list/detail. Không cần tự gán `resolvedAt`.
6. `409 INCIDENT_ALREADY_RESOLVED`: refetch detail; đây có thể là admin khác vừa xử lý.

Đổi tuyến hoặc thay xe không tự resolve incident. FE chỉ coi incident đã đóng khi API incident trả `status: "RESOLVED"`.

## 1. Danh sách sự cố

### `GET /v1/operator/incidents`

Dùng để lọc và phân trang incident thuộc đúng `operatorId` trong JWT. Không thể truyền `operatorId` từ client.

Headers:

| Header | Bắt buộc | Giá trị |
|---|---:|---|
| `Authorization` | Có | `Bearer <accessToken>` |
| `Accept` | Không | `application/json` |

Query:

| Tên | Kiểu | Bắt buộc | Mặc định | Validation/hành vi |
|---|---|---:|---|---|
| `tripId` | UUID | Không | — | Nếu có không được là UUID rỗng |
| `category` | string | Không | — | Không phân biệt hoa/thường: `TRAFFIC_JAM`, `VEHICLE_BREAKDOWN`, `ACCIDENT`, `WEATHER`, `OTHER`; chuỗi trắng được coi như không lọc |
| `status` | string | Không | — | Không phân biệt hoa/thường: `OPEN`, `RESOLVED`; chuỗi trắng được coi như không lọc |
| `from` | date | Không | — | `YYYY-MM-DD`, ngày Việt Nam, inclusive |
| `to` | date | Không | — | `YYYY-MM-DD`, inclusive; phải `>= from`; `DateOnly.MaxValue` bị từ chối |
| `page` | integer | Không | `1` | `>= 1` |
| `pageSize` | integer | Không | `20` | `1..100` |

Thứ tự cố định: `reportedAt DESC`, sau đó `incidentId ASC`.

Ví dụ curl:

```bash
curl "https://api.vietride.online/v1/operator/incidents?status=OPEN&page=1&pageSize=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json"
```

Ví dụ fetch:

```js
const params = new URLSearchParams({ status: 'OPEN', page: '1', pageSize: '20' });
const response = await fetch(
  `https://api.vietride.online/v1/operator/incidents?${params}`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
const body = await response.json();
if (!response.ok) throw body;
const incidents = body.data.items;
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "incidentId": "40ca3095-5bd4-4f49-a874-1f224d930f01",
        "category": "TRAFFIC_JAM",
        "description": "Ùn tắc phía trước",
        "photoUrls": ["https://firebasestorage.googleapis.com/..."],
        "latitude": 10.7769,
        "longitude": 106.7009,
        "reportedAt": "2026-08-12T14:20:00+07:00",
        "status": "OPEN",
        "resolvedAt": null,
        "resolvedByUserId": null,
        "resolutionNote": null,
        "trip": {
          "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
          "status": "IN_PROGRESS",
          "departureDateTime": "2026-08-12T13:00:00+07:00",
          "route": {
            "routeId": "10000000-0000-4000-8000-000000000001",
            "name": "TP.HCM - Cần Thơ",
            "originStation": {
              "stationId": "20000000-0000-4000-8000-000000000001",
              "name": "Bến xe Miền Tây"
            },
            "destinationStation": {
              "stationId": "20000000-0000-4000-8000-000000000002",
              "name": "Bến xe Cần Thơ"
            }
          }
        },
        "reporter": {
          "userId": "30000000-0000-4000-8000-000000000001",
          "displayName": "Nguyễn Văn A",
          "role": "DRIVER"
        }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T14:30:00+07:00"
  }
}
```

`description`, `photoUrls`, tọa độ, các field resolve và `reporter.displayName`/`role` đều có thể `null`. `reporter` luôn là object có `userId`; nếu Identity không trả profile tương ứng thì chỉ `displayName` và `role` là `null`.

Lỗi từ code/route:

| HTTP | `error.code` | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Thiếu/hỏng/hết hạn token hoặc thiếu claim operator bắt buộc tại Gateway |
| 403 | `FORBIDDEN` | Role không phải Admin/Staff hoặc operator chưa approved |
| 403 | `OPERATOR_SUSPENDED` | Operator đang bị suspend |
| 422 | `VALIDATION_ERROR` | Query enum/date/page không hợp lệ |
| 429 | `RATE_LIMITED` | Vượt rate limit Gateway |
| 500 | `INTERNAL_ERROR` | Lỗi không được map; ví dụ Identity batch lookup ném lỗi ngoài các exception đã chuẩn hóa |
| 503 | `UPSTREAM_UNAVAILABLE` | Gateway không kết nối được Trip Service |

## 2. Chi tiết sự cố

### `GET /v1/operator/incidents/{incidentId}`

Path params:

| Tên | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `incidentId` | UUID | Có | UUID hợp lệ và không rỗng |

Headers giống endpoint list.

```bash
curl "https://api.vietride.online/v1/operator/incidents/$INCIDENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const response = await fetch(
  `https://api.vietride.online/v1/operator/incidents/${incidentId}`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
const body = await response.json();
if (!response.ok) throw body;
```

Response `200`: `data` là đúng một object incident có cùng schema với phần tử `items[]` ở endpoint list.

Lỗi riêng:

| HTTP | `error.code` | Nguyên nhân |
|---:|---|---|
| 404 | `INCIDENT_NOT_FOUND` | Không tồn tại **hoặc** incident thuộc operator khác; BE cố ý mask tenant |
| 422 | `VALIDATION_ERROR` | `incidentId` sai format/UUID rỗng |

Các lỗi auth/rate-limit/upstream dùng chung vẫn có thể xảy ra.

## 3. Đánh dấu sự cố đã xử lý

### `PATCH /v1/operator/incidents/{incidentId}/resolve`

Chỉ `OPERATOR_ADMIN`. BE dùng server clock cho `resolvedAt`, JWT `sub` cho `resolvedByUserId`, trim `resolutionNote`, rồi trả lại incident detail đã cập nhật.

Headers:

| Header | Bắt buộc | Validation |
|---|---:|---|
| `Authorization` | Có | Bearer token role `OPERATOR_ADMIN` |
| `Content-Type` | Có | `application/json` |
| `Idempotency-Key` | Có | UUID v4, format D 36 ký tự |

Body:

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `resolutionNote` | string | Có | Sau trim dài `1..1000` ký tự |

```json
{
  "resolutionNote": "Đã chuyển sang tuyến tránh và thông báo cho hành khách."
}
```

```bash
curl -X PATCH "https://api.vietride.online/v1/operator/incidents/$INCIDENT_ID/resolve" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 2cfb8d76-50eb-4ac4-9e60-15b43d66bb67" \
  -d '{"resolutionNote":"Đã chuyển sang tuyến tránh và thông báo cho hành khách."}'
```

```js
const idempotencyKey = crypto.randomUUID();
const response = await fetch(
  `https://api.vietride.online/v1/operator/incidents/${incidentId}/resolve`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ resolutionNote: note.trim() }),
  },
);
const body = await response.json();
if (!response.ok) throw body;
```

Response `200`: incident detail đầy đủ; các field thay đổi chính:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "incidentId": "40ca3095-5bd4-4f49-a874-1f224d930f01",
    "category": "TRAFFIC_JAM",
    "description": "Ùn tắc phía trước",
    "photoUrls": null,
    "latitude": 10.7769,
    "longitude": 106.7009,
    "reportedAt": "2026-08-12T14:20:00+07:00",
    "status": "RESOLVED",
    "resolvedAt": "2026-08-12T14:35:12+07:00",
    "resolvedByUserId": "7ab056bd-110b-49ad-b4a8-c9805d79c360",
    "resolutionNote": "Đã chuyển sang tuyến tránh và thông báo cho hành khách.",
    "trip": {
      "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
      "status": "IN_PROGRESS",
      "departureDateTime": "2026-08-12T13:00:00+07:00",
      "route": {
        "routeId": "10000000-0000-4000-8000-000000000001",
        "name": "TP.HCM - Cần Thơ",
        "originStation": {
          "stationId": "20000000-0000-4000-8000-000000000001",
          "name": "Bến xe Miền Tây"
        },
        "destinationStation": {
          "stationId": "20000000-0000-4000-8000-000000000002",
          "name": "Bến xe Cần Thơ"
        }
      }
    },
    "reporter": {
      "userId": "30000000-0000-4000-8000-000000000001",
      "displayName": "Nguyễn Văn A",
      "role": "DRIVER"
    }
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T14:35:12+07:00"
  }
}
```

Lỗi riêng:

| HTTP | `error.code` | Nguyên nhân/cách xử lý FE |
|---:|---|---|
| 403 | `FORBIDDEN` | Staff hoặc role khác gọi resolve; ẩn nút với Staff |
| 404 | `INCIDENT_NOT_FOUND` | Không tồn tại hoặc khác tenant |
| 409 | `INCIDENT_ALREADY_RESOLVED` | Incident đã resolve bởi request/key khác; refetch detail |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Cùng request đang xử lý; giữ key và retry sau |
| 422 | `VALIDATION_ERROR` | Note rỗng/quá 1000, path sai hoặc idempotency key sai UUID v4 |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu header |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Tái dùng cùng key cho request/body khác; tạo key mới cho thao tác mới |

## 4. Báo cáo sự cố từ chuyến đi

### `POST /v1/driver/trips/{tripId}/incident`

Endpoint có thật trong source, dành cho `DRIVER`/`ASSISTANT` được phân công vào chuyến. Theo phạm vi tích hợp hiện tại, Incident UI mới chỉ giao cho Admin Web; Mobile Driver không cần triển khai màn mới nếu product chưa giao, nhưng agent Mobile Driver cần biết endpoint này tồn tại để không tự gọi API resolve.

Headers: Bearer token, `Content-Type: application/json`, `Idempotency-Key: <UUID-v4>`.

Body:

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `category` | string | Có | Case-sensitive: `TRAFFIC_JAM`, `VEHICLE_BREAKDOWN`, `ACCIDENT`, `WEATHER`, `OTHER` |
| `description` | string/null | Không | Trim; tối đa 500 ký tự |
| `photoUrls` | string[]/null | Không | Tối đa 3; absolute HTTPS; Firebase object thuộc prefix `incidents/{operatorId}/{reporterUserId}/` |
| `latitude` | number/null | Không | `-90..90`; phải cùng có/cùng thiếu với longitude |
| `longitude` | number/null | Không | `-180..180`; phải cùng có/cùng thiếu với latitude |

```json
{
  "category": "VEHICLE_BREAKDOWN",
  "description": "Xe mất áp suất lốp sau",
  "photoUrls": [
    "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/incidents%2F<operatorId>%2F<userId>%2Fphoto.jpg?alt=media"
  ],
  "latitude": 10.7769,
  "longitude": 106.7009
}
```

```bash
curl -X POST "https://api.vietride.online/v1/driver/trips/$TRIP_ID/incident" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 7ea162e9-5c51-447d-b3b0-bbcdbdc7a444" \
  -d '{"category":"VEHICLE_BREAKDOWN","description":"Xe mất áp suất lốp sau","photoUrls":null,"latitude":10.7769,"longitude":106.7009}'
```

```js
const response = await fetch(
  `https://api.vietride.online/v1/driver/trips/${tripId}/incident`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      category: 'VEHICLE_BREAKDOWN',
      description: 'Xe mất áp suất lốp sau',
      photoUrls: null,
      latitude: 10.7769,
      longitude: 106.7009,
    }),
  },
);
const body = await response.json();
if (!response.ok) throw body;
```

Response `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "incidentId": "40ca3095-5bd4-4f49-a874-1f224d930f01",
    "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
    "reportedByUserId": "30000000-0000-4000-8000-000000000001",
    "category": "VEHICLE_BREAKDOWN",
    "description": "Xe mất áp suất lốp sau",
    "photoUrls": null,
    "latitude": 10.7769,
    "longitude": 106.7009,
    "reportedAt": "2026-08-12T14:20:00+07:00"
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T14:20:00+07:00"
  }
}
```

Lỗi riêng:

| HTTP | `error.code` | Nguyên nhân |
|---:|---|---|
| 403 | `FORBIDDEN` | Không phải driver/assistant được phân công |
| 404 | `TRIP_NOT_FOUND` | Chuyến không tồn tại |
| 422 | `TRIP_NOT_IN_PROGRESS` | Chuyến chưa bắt đầu hoặc đã kết thúc |
| 422 | `VALIDATION_ERROR` | Body/photo/toạ độ không hợp lệ |

## Xử lý lỗi dùng chung

FE nên switch theo `error.code`, không switch theo message:

```js
async function readApiResponse(response) {
  const body = await response.json();
  if (response.ok && body.success) return body.data;

  switch (body.error?.code) {
    case 'AUTH_TOKEN_INVALID':
      // Refresh đúng một lần, sau đó đưa user về login nếu vẫn 401.
      break;
    case 'RATE_LIMITED':
      // Disable submit ngắn hạn; không retry dồn dập.
      break;
    case 'INCIDENT_ALREADY_RESOLVED':
      // Refetch detail/list.
      break;
  }
  throw body;
}
```

## Phân công FE

| Agent/dev | Phần cần bắt và handle |
|---|---|
| Admin/Operator Web | Toàn bộ list/detail/resolve; Admin thấy nút resolve, Staff chỉ đọc; refetch khi `INCIDENT_ALREADY_RESOLVED`; hiển thị `resolutionNote`, `resolvedAt`, `resolvedByUserId` |
| Mobile Driver | Không nhận UI Incident trong scope hiện tại. Chỉ giữ kiến thức endpoint report hiện hữu; tuyệt đối không gọi resolve |
| Mobile Passenger | Không có endpoint Incident public trong scope này; không cần triển khai |

## Checklist tích hợp

- [ ] Dùng `data.items`, không đọc list ở root response.
- [ ] Chỉ `OPERATOR_ADMIN` thấy nút resolve.
- [ ] UUID v4 được tạo một lần cho một thao tác resolve và được giữ nguyên khi retry.
- [ ] Không tự đổi incident sang `RESOLVED` khi đổi tuyến/thay xe.
- [ ] Sau resolve dùng object response hoặc refetch, không tự tạo timestamp ở client.
- [ ] Xử lý `404` như not-found chung, không phân biệt cross-tenant.
- [ ] Hiển thị null-safe cho reporter/profile/photo/location.
- [ ] Dùng ISO timestamp có offset từ server; không cộng thêm `+07:00` lần nữa.
