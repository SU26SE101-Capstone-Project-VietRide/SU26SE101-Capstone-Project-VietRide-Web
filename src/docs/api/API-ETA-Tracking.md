# ETA / Tracking API — Hướng dẫn tích hợp Frontend và Mobile

> Windows không cho phép ký tự `/` trong tên file, vì vậy tài liệu được lưu là `API-ETA-Tracking.md`. Nội dung được đối chiếu trực tiếp với source ngày 2026-08-12.

## Mục lục

- [Môi trường](#môi-trường)
- [Xác thực và response envelope](#xác-thực-và-response-envelope)
- [ETA nào dùng ở đâu](#eta-nào-dùng-ở-đâu)
- [Bảng REST endpoint](#bảng-rest-endpoint)
- [Tracking chuyến chính](#tracking-chuyến-chính)
- [Operator fleet](#operator-fleet)
- [Shuttle tracking](#shuttle-tracking)
- [Chia sẻ hành trình](#chia-sẻ-hành-trình)
- [Socket.IO realtime](#socketio-realtime)
- [Flow tích hợp theo nền tảng](#flow-tích-hợp-theo-nền-tảng)
- [Bảng lỗi](#bảng-lỗi)
- [Checklist](#checklist)

## Môi trường

| Surface | Production | Local |
|---|---|---|
| REST qua Gateway | `https://api.vietride.online` | `http://localhost:3000` |
| Tracking Service trực tiếp, chỉ debug BE | — | `http://localhost:3001` |
| Socket.IO | origin `https://api.vietride.online`, path `/tracking/socket.io` | origin theo Nginx local hoặc `http://localhost:3001`, path `/tracking/socket.io` |
| Swagger aggregator | `https://api.vietride.online/docs` | `http://localhost:3000/docs` |

REST của FE luôn đi qua Gateway. Socket tracking cố ý đi thẳng Nginx → Tracking Service, không qua proxy Gateway.

Trạng thái deployment được kiểm tra lại ngày 2026-08-12: `https://api.vietride.online/api-specs/tracking` trả `200`; Swagger aggregator có thể tải definition Tracking qua endpoint này. Source expose raw OpenAPI tại `/docs-json` và Gateway rewrite `/api-specs/tracking` → `/docs-json`.

## Xác thực và response envelope

REST bảo vệ bằng:

```http
Authorization: Bearer <accessToken>
```

Token là User Access Token RS256, issuer `vietride-identity`, audience `vietride-api`. Token mặc định sống 900 giây. Khi token hết hạn, refresh đúng một lần qua `POST /v1/auth/refresh`, rồi retry request hoặc reconnect socket với token mới.

Tracking authorization không chỉ dựa vào role:

- `DRIVER`/`ASSISTANT`: phải được phân công đúng chuyến.
- `OPERATOR_ADMIN`/`OPERATOR_STAFF`: trip phải thuộc operator trong token.
- `PASSENGER`: được phép nếu là booking owner hoặc parcel sender/recipient của trip.

Success REST:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-08-12T15:00:00+07:00"
  }
}
```

Error REST:

```json
{
  "success": false,
  "statusCode": 403,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "User is not allowed to access tracking data for this trip"
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-08-12T15:00:00+07:00"
  }
}
```

Quy ước:

- Public timestamp là ISO 8601 có offset `+07:00`.
- GPS input `recordedAt` bắt buộc RFC 3339 có `Z` hoặc offset; service chuẩn hóa về UTC trước khi lưu.
- Gateway rate limit mặc định `120 request / 60 giây / IP / route`.
- `latest: null`, `eta: null`, `etas: []` là response thành công hợp lệ, không phải lỗi.
- REST ETA chỉ đọc cache. GET không gọi Google Routes đồng bộ.

## ETA nào dùng ở đâu

Trong hệ thống có hai khái niệm khác nhau:

| Loại | Nguồn | Field | Cách dùng |
|---|---|---|---|
| Planned ETA | Trip snapshot/lịch chuyến | `departureDateTime`, `TripStop.estimatedArrivalTime`, `Trip.estimatedArrivalTime` | Baseline trước khi có GPS hoặc để hiển thị lịch |
| Dynamic ETA | GPS → Google Routes hoặc fallback → Redis cache | REST `/eta`, `/etas`; socket `eta:batch:update` | Thời gian dự kiến hiện tại khi tracking |

Target chain thật trong code:

- Trip `SCHEDULED` hoặc `BOARDING`: target là origin `STATION` — thời gian xe đến bến đầu.
- Trip `IN_PROGRESS`: các `STOP` chưa hoàn thành theo `sequence`, sau đó destination `STATION`.
- Express trip không có stop hoặc xe đã qua stop cuối: vẫn có ETA destination station nếu cache đã được tạo.
- Trip không ở ba trạng thái trên: target chain rỗng.
- Không tính riêng per-passenger. Passenger/parcel dùng chung ETA của physical stop/station và chọn target bằng `trackingTarget` hoặc `dropoffStopId`.

`estimateQuality`:

- `TRAFFIC_AWARE`: kết quả provider Google Routes.
- `FALLBACK`: tính từ GPS speed + khoảng cách theo target chain; pre-origin dùng direct distance đến origin.

Cache/recalculation từ env source:

- Provider interval tối thiểu: 60 giây.
- ETA cache TTL mặc định: 60 giây.
- Sau 3 lỗi provider, failure cooldown mặc định: 300 giây.
- Google timeout mặc định: 1500 ms.

Do đó FE không được giả định mỗi `gps:update` luôn đi kèm ETA mới.

## Bảng REST endpoint

| Method | Path | Dành cho | Mô tả |
|---|---|---|---|
| `GET` | `/v1/tracking/trips/{tripId}/route-geometry` | Cả 3 nền tảng | Geometry và marker theo effective assigned-route snapshot |
| `GET` | `/v1/tracking/trips/{tripId}/latest` | Cả 3 | GPS mới nhất |
| `GET` | `/v1/tracking/trips/{tripId}/trail` | Admin/Driver, Passenger nếu được authorize | Lịch sử GPS có phân trang |
| `GET` | `/v1/tracking/trips/{tripId}/eta` | Cả 3 | Một ETA theo target hoặc target kế tiếp |
| `GET` | `/v1/tracking/trips/{tripId}/etas` | Cả 3 | Tất cả ETA cache còn lại theo thứ tự |
| `GET` | `/v1/tracking/operator/fleet-latest` | Admin/Staff | GPS mới nhất của fleet |
| `GET` | `/v1/tracking/shuttle-trips/{shuttleTripId}/passenger-context` | Passenger | Pickup context của chính passenger |
| `GET` | `/v1/tracking/shuttle-trips/{shuttleTripId}/latest` | User được authorize | GPS shuttle mới nhất |
| `GET` | `/v1/tracking/shuttle-trips/{shuttleTripId}/eta` | User được authorize | ETA pickup shuttle |
| `PUT` | `/v1/tracking/trips/{tripId}/share-link` | Passenger booking owner | Tạo/lấy link chia sẻ |
| `DELETE` | `/v1/tracking/trips/{tripId}/share-link` | Passenger booking owner | Thu hồi link chia sẻ |
| `GET` | `/v1/tracking/shared-trip/context` | Anonymous có share token | Context privacy-safe |

`/health`, `/ready` và `/internal/v1/*` không phải API FE.

## Tracking chuyến chính

Tất cả endpoint trong mục này cần Bearer token. `tripId` là UUID bắt buộc. Sai format bị guard trả `400 VALIDATION_FAILED`.

### 1. Route geometry

`GET /v1/tracking/trips/{tripId}/route-geometry`

Headers:

| Header | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `Authorization` | Có | Bearer token |
| `If-None-Match` | Không | Strong ETag nhận từ lần trước |

```bash
curl -i "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/route-geometry" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'If-None-Match: "previous-route-version"'
```

```js
const response = await fetch(`${API}/v1/tracking/trips/${tripId}/route-geometry`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    ...(routeEtag ? { 'If-None-Match': routeEtag } : {}),
  },
});
if (response.status === 304) return cachedRouteContext;
const body = await response.json();
routeEtag = response.headers.get('etag');
return body.data;
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
    "tripStatus": "IN_PROGRESS",
    "geometry": {
      "source": "ROUTE_POLYLINE",
      "points": [
        { "latitude": 10.7408, "longitude": 106.6183 },
        { "latitude": 10.4551, "longitude": 105.6340 }
      ]
    },
    "originStation": {
      "stationId": "20000000-0000-4000-8000-000000000001",
      "name": "Bến xe Miền Tây",
      "latitude": 10.7408,
      "longitude": 106.6183
    },
    "intermediateStops": [
      {
        "stopId": "21000000-0000-4000-8000-000000000001",
        "name": "Trạm Tiền Giang",
        "sequence": 1,
        "latitude": 10.3600,
        "longitude": 106.3600
      }
    ],
    "destinationStation": {
      "stationId": "20000000-0000-4000-8000-000000000002",
      "name": "Bến xe Cần Thơ",
      "latitude": 10.0452,
      "longitude": 105.7469
    }
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-08-12T15:00:00+07:00"
  }
}
```

Nullability đúng code: `tripStatus?`, `geometry`, `originStation`, `destinationStation` có thể thiếu/null; `intermediateStops` là array. Geometry alternative route lỗi chỉ có thể trở thành stop-only/null của chính effective route; code không fallback sang base route. Stop sequence lấy từ `TripStop` snapshot đã assign, không đọc catalog alternative live.

Headers response:

- Strong `ETag`; đây cũng là `routeVersion` của Socket snapshot.
- `Cache-Control: private,max-age=600` khi có polyline; `private,max-age=30` nếu không có polyline.
- `Vary: Authorization`.
- Exact `If-None-Match` trùng ETag → `304` không có JSON body.

Lỗi riêng: `404 TRIP_NOT_FOUND`, `503 TRACKING_ROUTE_CONTEXT_UNAVAILABLE`; auth errors xem bảng cuối.

### 2. GPS mới nhất

`GET /v1/tracking/trips/{tripId}/latest`

```bash
curl "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/latest" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet(`/v1/tracking/trips/${tripId}/latest`, accessToken);
const point = data.latest; // null là hợp lệ
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "latest": {
      "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
      "latitude": 10.5101,
      "longitude": 106.1202,
      "speedKmh": 47.5,
      "headingDeg": 215,
      "recordedAt": "2026-08-12T14:58:10+07:00"
    }
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

`speedKmh` và `headingDeg` optional. Khi Redis không có hoặc cache hỏng/hết hạn, `data.latest` là `null`.

### 3. GPS trail

`GET /v1/tracking/trips/{tripId}/trail`

Query:

| Field | Kiểu | Bắt buộc | Mặc định/rule |
|---|---|---:|---|
| `from` | RFC 3339 timestamp có offset | Không | Inclusive |
| `to` | RFC 3339 timestamp có offset | Không | Inclusive; `from <= to` |
| `page` | integer | Không | `1`, phải `>=1` |
| `pageSize` | integer | Không | `20`; code clamp về `1..100` |
| `sortBy` | string | Không | Chỉ `recordedAt` |
| `sortDir` | string | Không | `asc`; `asc` hoặc `desc` |

```bash
curl "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/trail?from=2026-08-12T06%3A00%3A00Z&to=2026-08-12T09%3A00%3A00Z&page=1&pageSize=100&sortDir=asc" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const qs = new URLSearchParams({
  from: new Date(from).toISOString(),
  to: new Date(to).toISOString(),
  page: '1',
  pageSize: '100',
  sortBy: 'recordedAt',
  sortDir: 'asc',
});
const { data } = await apiGet(`/v1/tracking/trips/${tripId}/trail?${qs}`, accessToken);
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
        "latitude": 10.5101,
        "longitude": 106.1202,
        "speedKmh": 47.5,
        "headingDeg": 215,
        "recordedAt": "2026-08-12T14:58:10+07:00"
      }
    ],
    "page": 1,
    "pageSize": 100,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

Query sai trả `422 VALIDATION_ERROR`.

### 4. Một ETA

`GET /v1/tracking/trips/{tripId}/eta`

Ba mode query hợp lệ:

| Mode | Query |
|---|---|
| Tự chọn target đầu tiên có cache | Không truyền query |
| Legacy stop | `?stopId={uuid}` |
| Explicit stop | `?targetKind=STOP&stopId={uuid}` |
| Explicit station | `?targetKind=STATION&stationId={uuid}` |

Mọi tổ hợp khác bị `400` validation, ví dụ `targetKind=STATION&stopId=...` hoặc có cả `stopId` và `stationId`.

```bash
curl "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/eta?targetKind=STOP&stopId=$STOP_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const qs = new URLSearchParams({ targetKind: 'STATION', stationId });
const { data } = await apiGet(`/v1/tracking/trips/${tripId}/eta?${qs}`, accessToken);
const eta = data.eta; // null nếu target/cached ETA chưa có
```

Response `200` có cache:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "eta": {
      "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
      "targetKind": "STOP",
      "stopId": "21000000-0000-4000-8000-000000000001",
      "stopName": "Trạm Tiền Giang",
      "etaMinutes": 18,
      "estimatedArrivalTime": "2026-08-12T15:18:00+07:00",
      "distanceMeters": 13200,
      "updatedAt": "2026-08-12T15:00:00+07:00",
      "sequence": 1,
      "estimateQuality": "TRAFFIC_AWARE",
      "delayed": false,
      "delayStatus": "ON_TIME",
      "delayMinutes": 0
    }
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

Schema ETA:

| Field | Kiểu/nullable | Ý nghĩa |
|---|---|---|
| `tripId` | UUID | Trip |
| `targetKind` | `STOP \| STATION` | Loại target vật lý |
| `stopId` | UUID optional | Có với STOP |
| `stationId` | UUID optional | Có với STATION |
| `stopName` | string/null/optional | Tên stop hoặc station; tên field vẫn là `stopName` cho station |
| `etaMinutes` | positive integer | Phút còn lại |
| `estimatedArrivalTime` | timestamp | Thời điểm dự kiến đến target |
| `distanceMeters` | non-negative integer | Khoảng cách còn lại |
| `updatedAt` | timestamp | Lúc cache được tính |
| `sequence` | positive integer optional | Chỉ meaningful cho intermediate stop |
| `estimateQuality` | `TRAFFIC_AWARE \| FALLBACK` | Chất lượng phép tính |
| `delayed` | boolean/null | Station luôn `null` |
| `delayStatus` | `DELAYED \| ON_TIME \| UNKNOWN` | Station luôn `UNKNOWN` |
| `delayMinutes` | non-negative integer/null | Station luôn `null` |

Cold cache hoặc target không thuộc route trả `200` với `{ "eta": null }`.

### 5. Toàn bộ ETA còn lại

`GET /v1/tracking/trips/{tripId}/etas`

```bash
curl "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/etas" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet(`/v1/tracking/trips/${tripId}/etas`, accessToken);
for (const eta of data.etas) renderEtaMarker(eta);
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "etas": [
      {
        "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
        "targetKind": "STOP",
        "stopId": "21000000-0000-4000-8000-000000000001",
        "stopName": "Trạm Tiền Giang",
        "etaMinutes": 18,
        "estimatedArrivalTime": "2026-08-12T15:18:00+07:00",
        "distanceMeters": 13200,
        "updatedAt": "2026-08-12T15:00:00+07:00",
        "sequence": 1,
        "estimateQuality": "TRAFFIC_AWARE",
        "delayed": false,
        "delayStatus": "ON_TIME",
        "delayMinutes": 0
      },
      {
        "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
        "targetKind": "STATION",
        "stationId": "20000000-0000-4000-8000-000000000002",
        "stopName": "Bến xe Cần Thơ",
        "etaMinutes": 72,
        "estimatedArrivalTime": "2026-08-12T16:12:00+07:00",
        "distanceMeters": 78000,
        "updatedAt": "2026-08-12T15:00:00+07:00",
        "estimateQuality": "TRAFFIC_AWARE",
        "delayed": null,
        "delayStatus": "UNKNOWN",
        "delayMinutes": null
      }
    ]
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

Array chỉ chứa target có cache hợp lệ; cold cache là `etas: []`. Thứ tự là remaining stop theo sequence rồi destination station.

## Operator fleet

### `GET /v1/tracking/operator/fleet-latest`

Role: `OPERATOR_ADMIN`, `OPERATOR_STAFF`; phải có `operatorId`.

Query `status` optional, enum: `SCHEDULED`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DISRUPTED`.

```bash
curl "https://api.vietride.online/v1/tracking/operator/fleet-latest?status=IN_PROGRESS" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet('/v1/tracking/operator/fleet-latest?status=IN_PROGRESS', accessToken);
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
        "latitude": 10.5101,
        "longitude": 106.1202,
        "speedKmh": 47.5,
        "headingDeg": 215,
        "recordedAt": "2026-08-12T14:58:10+07:00",
        "status": "IN_PROGRESS"
      }
    ],
    "generatedAt": "2026-08-12T15:00:00+07:00"
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

Chỉ trip projection có GPS Redis hợp lệ mới xuất hiện. Lỗi projection hiện không có mapping riêng và có thể thành `500 INTERNAL_ERROR`.

## Shuttle tracking

Tất cả endpoint dùng `shuttleTripId` UUID và Bearer token. Guard có thể trả `400 VALIDATION_FAILED`, `401 UNAUTHORIZED`, `403 TRACKING_ACCESS_DENIED`, `404 SHUTTLE_TRIP_NOT_FOUND`, `503 TRACKING_AUTH_UNAVAILABLE`.

### 1. Passenger pickup context

`GET /v1/tracking/shuttle-trips/{shuttleTripId}/passenger-context`

Chỉ role `PASSENGER`; response `Cache-Control: private, no-store`.

```bash
curl "https://api.vietride.online/v1/tracking/shuttle-trips/$SHUTTLE_TRIP_ID/passenger-context" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet(`/v1/tracking/shuttle-trips/${shuttleTripId}/passenger-context`, accessToken);
```

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shuttleTripId": "40000000-0000-4000-8000-000000000001",
    "mainTripId": "7bfeff50-34df-4662-8625-ad36947d1474",
    "direction": "INBOUND_TO_STATION",
    "ownPickups": [
      {
        "bookingId": "50000000-0000-4000-8000-000000000001",
        "pickupOrder": 3,
        "serviceAddress": "123 Nguyễn Huệ, Quận 1",
        "serviceOrder": 3,
        "roadDistanceMeters": 4200,
        "latitude": 10.7626,
        "longitude": 106.6601,
        "status": "PENDING",
        "stopsBeforePickup": 2
      }
    ],
    "station": {
      "stationId": "20000000-0000-4000-8000-000000000001",
      "name": "Bến xe Miền Đông",
      "latitude": 10.8142,
      "longitude": 106.7101,
      "pickupOrder": 8
    }
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

`direction`: `INBOUND_TO_STATION | OUTBOUND_FROM_STATION`; pickup `status`: `PENDING | PICKED_UP`; `station` nullable; `serviceAddress`, `serviceOrder`, `roadDistanceMeters` optional.

### 2. Shuttle latest

`GET /v1/tracking/shuttle-trips/{shuttleTripId}/latest`

```bash
curl "https://api.vietride.online/v1/tracking/shuttle-trips/$SHUTTLE_TRIP_ID/latest" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet(`/v1/tracking/shuttle-trips/${shuttleTripId}/latest`, accessToken);
```

`data` là `null` hoặc:

```json
{
  "shuttleTripId": "40000000-0000-4000-8000-000000000001",
  "latitude": 10.7626,
  "longitude": 106.6601,
  "speedKmh": 32.5,
  "heading": 120,
  "recordedAt": "2026-08-12T14:59:00+07:00"
}
```

Chú ý shuttle dùng field `heading`, không phải `headingDeg`.

### 3. Shuttle ETA

`GET /v1/tracking/shuttle-trips/{shuttleTripId}/eta`

```bash
curl "https://api.vietride.online/v1/tracking/shuttle-trips/$SHUTTLE_TRIP_ID/eta" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const { data } = await apiGet(`/v1/tracking/shuttle-trips/${shuttleTripId}/eta`, accessToken);
```

`data` là `null` hoặc:

```json
{
  "shuttleTripId": "40000000-0000-4000-8000-000000000001",
  "nextPickupOrder": 3,
  "etaMinutes": 8,
  "estimatedArrivalTime": "2026-08-12T15:08:00+07:00",
  "distanceMeters": 4200,
  "updatedAt": "2026-08-12T15:00:00+07:00"
}
```

## Chia sẻ hành trình

### 1. Tạo/lấy share link

`PUT /v1/tracking/trips/{tripId}/share-link`

Chỉ `PASSENGER`, phải là booking owner và trip `IN_PROGRESS`. Không có body. Header `Idempotency-Key` UUID v4 bắt buộc.

```bash
curl -X PUT "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/share-link" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: 6b186033-cd53-42a4-9526-734855568292"
```

```js
const response = await fetch(`${API}/v1/tracking/trips/${tripId}/share-link`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Idempotency-Key': crypto.randomUUID(),
  },
});
const body = await response.json();
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shareUrl": "https://app.vietride.online/shared-trip#token=<capability-token>",
    "expiresAt": "2026-08-13T15:00:00+07:00"
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

Token nằm trong URL fragment `#token=...`, không nằm trong query. Browser không gửi fragment lên server; Shared Page phải tự parse rồi gắn token vào REST/socket.

### 2. Thu hồi share link

`DELETE /v1/tracking/trips/{tripId}/share-link`

Headers/role/idempotency giống PUT, không body. API idempotent; không có active link vẫn trả `{ "revoked": true }`.

```bash
curl -X DELETE "https://api.vietride.online/v1/tracking/trips/$TRIP_ID/share-link" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: 4b13dc29-a647-4b26-a2ee-b8434fd4708c"
```

```js
await fetch(`${API}/v1/tracking/trips/${tripId}/share-link`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': crypto.randomUUID() },
});
```

Response `200`: `data: { "revoked": true }`.

PUT/DELETE errors: `400 VALIDATION_FAILED`, `401 UNAUTHORIZED`, `403 ACCESS_DENIED`, `404 TRIP_NOT_FOUND`, `409 TRACKING_TRIP_NOT_ACTIVE`, idempotency `409/422`, `429 RATE_LIMITED`, `503 TRACKING_AUTH_UNAVAILABLE` hoặc `TRACKING_TRIP_UNAVAILABLE`.

### 3. Anonymous shared context

`GET /v1/tracking/shared-trip/context`

Không dùng Bearer. Header bắt buộc:

```http
X-Trip-Share-Token: <token lấy từ URL fragment>
```

```bash
curl "https://api.vietride.online/v1/tracking/shared-trip/context" \
  -H "X-Trip-Share-Token: $SHARE_TOKEN"
```

```js
const shareToken = new URLSearchParams(location.hash.slice(1)).get('token');
const response = await fetch(`${API}/v1/tracking/shared-trip/context`, {
  headers: { 'X-Trip-Share-Token': shareToken },
  referrerPolicy: 'no-referrer',
});
```

Response `200` privacy-safe:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "IN_PROGRESS",
    "expiresAt": "2026-08-13T15:00:00+07:00",
    "lastUpdatedAt": "2026-08-12T15:00:00+07:00",
    "vehicle": {
      "location": {
        "latitude": 10.5101,
        "longitude": 106.1202,
        "heading": 215,
        "speedKph": 47.5,
        "recordedAt": "2026-08-12T14:58:10+07:00"
      }
    },
    "route": {
      "originName": "Bến xe Miền Tây",
      "destinationName": "Bến xe Cần Thơ",
      "geometry": {
        "type": "LineString",
        "coordinates": [[106.6183, 10.7408], [105.7469, 10.0452]]
      }
    },
    "eta": {
      "estimatedArrivalAt": "2026-08-12T16:12:00+07:00",
      "remainingSeconds": 4320,
      "delayMinutes": null,
      "updatedAt": "2026-08-12T15:00:00+07:00"
    }
  },
  "meta": { "traceId": "req-a1b2c3d4", "timestamp": "2026-08-12T15:00:00+07:00" }
}
```

`vehicle.location`, `route.geometry`, `eta`, `lastUpdatedAt` nullable. GeoJSON coordinates dùng `[longitude, latitude]`.

Response headers: `Cache-Control: no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`.

Errors: `401 TRACKING_SHARE_TOKEN_INVALID`, `410 TRACKING_SHARE_LINK_UNAVAILABLE`, `429 RATE_LIMITED`, `503 TRACKING_SHARE_RATE_LIMIT_UNAVAILABLE` hoặc `TRACKING_TRIP_UNAVAILABLE`. Context limit mặc định `60/min/token`.

## Socket.IO realtime

Cài client bằng dependency hiện có của FE; BE không yêu cầu protocol WebSocket tự viết. Kết nối chuẩn:

```js
import { io } from 'socket.io-client';

const socket = io('https://api.vietride.online', {
  path: '/tracking/socket.io',
  auth: { token: accessToken },
  transports: ['websocket'],
  reconnection: true,
});

socket.on('connect_error', async (error) => {
  if (error.message === 'UNAUTHORIZED') {
    const freshToken = await refreshAccessTokenOnce();
    socket.auth = { token: freshToken };
    socket.connect();
  }
});
```

Standard namespace là `/`. Token được đọc từ `auth.token` trước, hoặc từ handshake header `Authorization: Bearer ...`. Token chỉ được verify khi handshake; sau refresh phải reconnect.

### Client → Server events

#### `joinTripTracking`

```js
socket.emit(
  'joinTripTracking',
  { tripId, includeRouteSnapshot: true },
  (ack) => {
    if (!ack.success) return handleTrackingAckError(ack.error);
    renderRoute(ack.routeContext);
    currentRouteVersion = ack.routeVersion;
  },
);
```

Payload:

| Field | Kiểu | Bắt buộc | Default |
|---|---|---:|---|
| `tripId` | UUID | Có | — |
| `includeRouteSnapshot` | boolean | Không | `false` |

Success ack:

```json
{
  "success": true,
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "room": "trip:7bfeff50-34df-4662-8625-ad36947d1474",
  "scope": "PARCEL_RECIPIENT",
  "routeContext": {
    "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
    "tripStatus": "IN_PROGRESS",
    "geometry": null,
    "originStation": null,
    "intermediateStops": [],
    "destinationStation": null
  },
  "routeVersion": "\"strong-etag-value\""
}
```

`routeContext`/`routeVersion` chỉ có khi opt-in `true`. Scope: `BOOKING_OWNER`, `DRIVER`, `ASSISTANT`, `OPERATOR`, `PARCEL_SENDER`, `PARCEL_RECIPIENT`. Nếu snapshot lỗi, ack `TRACKING_ROUTE_CONTEXT_UNAVAILABLE` và socket không join room.

Các ack error: `VALIDATION_ERROR`, `UNAUTHORIZED`, `ACCESS_DENIED`, `TRIP_NOT_FOUND`, `TRACKING_TRIP_NOT_ACTIVE`, `TRACKING_AUTH_UNAVAILABLE`, `TRACKING_ROUTE_CONTEXT_UNAVAILABLE`.

#### `gps:update`

Chỉ `DRIVER`/`ASSISTANT` đúng trip:

```js
socket.emit(
  'gps:update',
  {
    tripId,
    latitude: 10.5101,
    longitude: 106.1202,
    speedKmh: 47.5,
    headingDeg: 215,
    recordedAt: new Date().toISOString(),
  },
  (ack) => {
    if (!ack.success) handleTrackingAckError(ack.error);
  },
);
```

Validation: latitude `-90..90`, longitude `-180..180`, `speedKmh >= 0` optional, `headingDeg 0..360` optional, `recordedAt` RFC 3339 có offset.

Cùng `tripId + recordedAt` và cùng payload → `{success:true}` nhưng không broadcast lại. Cùng operation identity nhưng payload khác → `IDEMPOTENCY_KEY_REUSED`. Lỗi khác: `VALIDATION_ERROR`, `UNAUTHORIZED`, `ACCESS_DENIED`, error authorization hoặc `TRACKING_UNAVAILABLE`.

#### `joinOperatorFleet`

Không body; chỉ Admin/Staff có `operatorId`:

```js
socket.emit('joinOperatorFleet', (ack) => {
  if (!ack.success) handleTrackingAckError(ack.error);
});
```

Ack success `{ "success": true, "room": "operator:{operatorId}:fleet", "scope": "OPERATOR" }`.

#### `joinShuttleTracking`

```js
socket.emit('joinShuttleTracking', { shuttleTripId }, handleAck);
```

Payload chỉ có UUID `shuttleTripId`. Success ack có `tripId` bằng chính `shuttleTripId`, `room`, `scope`.

#### `shuttle:gps:update`

Chỉ `DRIVER` đúng shuttle:

```js
socket.emit('shuttle:gps:update', {
  shuttleTripId,
  latitude: 10.7626,
  longitude: 106.6601,
  speedKmh: 32.5,
  heading: 120,
  recordedAt: new Date().toISOString(),
}, handleAck);
```

Shuttle dùng `heading`, không phải `headingDeg`.

### Server → Client events

#### `gps:update`

```json
{
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "latitude": 10.5101,
  "longitude": 106.1202,
  "speedKmh": 47.5,
  "headingDeg": 215,
  "recordedAt": "2026-08-12T14:58:10+07:00"
}
```

Broadcast point có thể là tọa độ đã snap vào route nếu raw point nằm trong ngưỡng 50m.

#### `eta:batch:update`

Event chính cho FE mới, chứa cả STOP và STATION:

```json
{
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "etas": [
    {
      "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
      "targetKind": "STOP",
      "stopId": "21000000-0000-4000-8000-000000000001",
      "stopName": "Trạm Tiền Giang",
      "sequence": 1,
      "etaMinutes": 18,
      "estimatedArrivalTime": "2026-08-12T15:18:00+07:00",
      "distanceMeters": 13200,
      "updatedAt": "2026-08-12T15:00:00+07:00",
      "estimateQuality": "TRAFFIC_AWARE"
    }
  ],
  "updatedAt": "2026-08-12T15:00:00+07:00"
}
```

Socket batch target không có `delayed`, `delayStatus`, `delayMinutes`; các field đó có ở REST và legacy stop delay event.

#### `eta:update`

Legacy event chỉ emit khi primary target là `STOP`. Không dùng event này để suy ra ETA destination station. Payload là stop ETA sau delay evaluation và có `delayed`, `delayStatus`, `delayMinutes`.

#### `trip:statusChanged`

```json
{
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "stopId": "21000000-0000-4000-8000-000000000001",
  "status": "DELAYED",
  "delayMinutes": 31,
  "updatedAt": "2026-08-12T15:00:00+07:00"
}
```

`status`: `DELAYED | DELAY_CLEARED`.

#### Fleet/crew events

- `fleet:gps:update`: GPS fields + projected trip `status`, chỉ operator fleet room.
- `routeProposal:created`, `routeProposal:resolved`: `{proposalId, tripId, status, createdAt}` cho operator fleet room.

`booking:created` chỉ emit vào crew room và giữ nguyên operational contract sau khi đổi timestamp sang format frontend:

```json
{
  "eventId": "55000000-0000-4000-8000-000000000001",
  "occurredAt": "2026-08-12T15:00:00+07:00",
  "bookingId": "56000000-0000-4000-8000-000000000001",
  "bookingCode": "VRB-20260812-ABCD1234",
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "status": "CONFIRMED",
  "ticketCodes": ["VRT-20260812-0001"],
  "seatNumbers": ["A01"],
  "departureDateTime": "2026-08-12T16:00:00+07:00",
  "passengerCount": 1,
  "pickup": {
    "stationId": "20000000-0000-4000-8000-000000000001",
    "stopId": null,
    "address": "Bến xe Miền Tây"
  },
  "dropoff": {
    "stationId": null,
    "stopId": "21000000-0000-4000-8000-000000000001",
    "address": "Trạm Tiền Giang"
  },
  "driverUserId": "57000000-0000-4000-8000-000000000001",
  "assistantUserId": null
}
```

Validation upstream của contract này: UUID đúng format; `status` chỉ `CONFIRMED`; `ticketCodes`/`seatNumbers` không rỗng; `passengerCount > 0`; `passengerCount === ticketCodes.length`; `seatNumbers.length === ticketCodes.length`; `pickup`/`dropoff` là strict object có đúng `stationId`, `stopId`, `address`, mỗi field nullable.

`booking:updated` có bốn shape thật theo `reason`:

| `reason` | Field được emit |
|---|---|
| `BOOKING_CREATED` | `eventId,occurredAt,tripId,bookingId,bookingCode,seatNumbers,reason` |
| `BOOKING_CANCELLED` | Các field trên + `cancellationReason` |
| `PASSENGER_BOARDED` | `eventId,occurredAt,tripId,bookingId,bookingCode,seatNumbers,reason,passengerRecordId,ticketCode,boardedAt`; `seatNumbers` có đúng seat vừa board |
| `BOOKING_TRANSFERRED` | `eventId,occurredAt,tripId,bookingId,reason,oldTripId,newTripId,transfers`; emit vào crew room của cả old/new trip |

Item trong `transfers` là `{passengerId,originalSeatNumber,newSeatNumber,confirmationStatus}`; hai seat nullable, `confirmationStatus` là `PENDING_CONFIRM | CONFIRMED | NOT_REQUIRED`.

#### Shuttle events

- `shuttle:gps:update`: cùng shape shuttle latest.
- `shuttle:eta:update`: `{shuttleTripId,nextPickupOrder,etaMinutes,estimatedArrivalTime,distanceMeters,updatedAt}`.

### Anonymous shared namespace

Namespace `/shared`, cùng path `/tracking/socket.io`:

```js
const sharedSocket = io('https://api.vietride.online/shared', {
  path: '/tracking/socket.io',
  auth: { shareToken },
  transports: ['websocket'],
});
```

Không emit join event; server authorize và join room ngay trong handshake. Connect errors: `TRACKING_SHARE_TOKEN_INVALID`, `TRACKING_SHARE_LINK_UNAVAILABLE`, `RATE_LIMITED`, `TRACKING_SHARE_ACCESS_UNAVAILABLE`.

Server events:

```js
sharedSocket.on('shared:gps:update', ({ location }) => { /* latitude, longitude, heading, speedKph, recordedAt */ });
sharedSocket.on('shared:eta:update', ({ eta }) => { /* estimatedArrivalAt, remainingSeconds, delayMinutes, delayStatus, updatedAt */ });
sharedSocket.on('shared:trip:statusChanged', ({ status, delayMinutes, updatedAt }) => {});
sharedSocket.on('shared:access:revoked', ({ reason }) => {
  // EXPIRED | REVOKED | TRIP_ENDED | ACCESS_UNAVAILABLE
});
```

Socket share limit mặc định `20/min/token`, revalidate mặc định mỗi 60 giây, token TTL mặc định 86400 giây.

## Flow tích hợp theo nền tảng

### Mobile Passenger

1. Lấy `trackingTarget` từ passenger history hoặc dùng parcel `dropoffStopId`/destination station.
2. Fetch `route-geometry`, `latest`, `/etas` để hydrate màn ngay.
3. Connect Socket và `joinTripTracking({tripId, includeRouteSnapshot:true})`.
4. Nếu `routeVersion` khác ETag đang cache, thay toàn bộ route snapshot trước khi render tiếp.
5. Subscribe `gps:update`, `eta:batch:update`; chọn ETA theo `targetKind + targetId`, không theo index array.
6. Với shuttle, fetch passenger-context/latest/eta rồi join shuttle room.
7. Nếu có share link, parse token từ fragment và không log token/đẩy vào analytics/referrer.

### Mobile Driver

1. Connect socket với access token mới nhất.
2. `joinTripTracking(...includeRouteSnapshot:true)`; chỉ bắt đầu GPS sau ack `scope` là `DRIVER` hoặc `ASSISTANT`.
3. Emit `gps:update` với `recordedAt` cố định cho lần retry cùng sample; không đổi payload khi retry cùng identity.
4. Render `eta:batch:update` cho stop kế tiếp và destination; legacy `eta:update` chỉ cho stop delay.
5. Subscribe `booking:updated` và các route/operational event cần cho crew UI.
6. Shuttle dùng event/payload riêng, đặc biệt field `heading`.

### Admin/Operator Web

1. Fetch `fleet-latest`, connect socket và `joinOperatorFleet`.
2. Merge `fleet:gps:update` theo `tripId`, không append vô hạn.
3. Khi mở trip: fetch hoặc socket opt-in route snapshot, rồi fetch `/etas` và subscribe batch ETA.
4. Invalidate route khi nhận route-change/proposal flow; snapshot reconnect phải được áp dụng trước marker GPS.
5. Staff và Admin đều xem fleet; không dùng Passenger share token cho operator UI.

Helper REST dùng trong ví dụ:

```js
const API = 'https://api.vietride.online';
async function apiGet(path, accessToken) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw body;
  return body;
}
```

## Bảng lỗi

| HTTP/surface | Code | Khi xảy ra |
|---|---|---|
| 400 | `VALIDATION_FAILED` | UUID/path sai; guard tracking/shuttle |
| 400 | `VALIDATION_ERROR` | ETA query combination sai theo Zod mặc định |
| 401 | `AUTH_TOKEN_INVALID` | Gateway từ chối token |
| 401 | `UNAUTHORIZED` | Tracking Service thiếu/hỏng Bearer hoặc socket handshake |
| 403 | `ACCESS_DENIED` | Không có ownership/assignment/operator scope |
| 403 | `TRACKING_TRIP_NOT_ACTIVE` | Authorization provider xác định trip không active |
| 403 | `TRACKING_ACCESS_DENIED` | Shuttle passenger/context access bị từ chối |
| 404 | `TRIP_NOT_FOUND` | Trip không tồn tại |
| 404 | `SHUTTLE_TRIP_NOT_FOUND` | Shuttle trip không tồn tại |
| 409 | `TRACKING_TRIP_NOT_ACTIVE` | Share link chỉ cho trip đang `IN_PROGRESS` |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Share mutation cùng key đang xử lý |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu key ở share mutation |
| 422 | `VALIDATION_ERROR` | Key không phải UUID v4 hoặc trail query sai |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Dùng lại key cho request khác |
| 429 | `RATE_LIMITED` | Gateway/share-token limiter |
| 500 | `INTERNAL_ERROR` | Lỗi không map |
| 503 | `TRACKING_AUTH_UNAVAILABLE` | Authorization downstream lỗi |
| 503 | `TRACKING_ROUTE_CONTEXT_UNAVAILABLE` | Không lấy được effective route snapshot |
| 503 | `TRACKING_CONTEXT_UNAVAILABLE` | Shuttle context thiếu sau auth |
| 503 | `TRACKING_TRIP_UNAVAILABLE` | Shared-trip provider lỗi |
| 503 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được Tracking Service |
| Socket ack | `IDEMPOTENCY_KEY_REUSED` | Cùng GPS operation identity nhưng payload khác |
| Socket ack | `TRACKING_UNAVAILABLE` | Không persist được GPS |

## Checklist

- [ ] REST đi qua Gateway; Socket dùng đúng path `/tracking/socket.io`.
- [ ] Reconnect socket bằng access token mới sau refresh.
- [ ] Luôn xử lý `latest:null`, `eta:null`, `etas:[]` như trạng thái “chưa có dữ liệu”.
- [ ] Dùng `eta:batch:update` cho target STOP và STATION; không dựa chỉ vào legacy `eta:update`.
- [ ] Key cache ETA là `(tripId, targetKind, stopId/stationId)`.
- [ ] Pre-origin hiển thị origin station ETA; express/after-last-stop hiển thị destination station ETA.
- [ ] Không tự tính ETA per passenger trên FE.
- [ ] Dùng `routeVersion`/ETag để thay snapshot atomically sau đổi tuyến.
- [ ] Không fallback UI sang base route khi BE báo effective alternative snapshot unavailable.
- [ ] GPS input có `recordedAt` với timezone/`Z`; không dùng local datetime không offset.
- [ ] Shuttle dùng `heading`; trip chính dùng `headingDeg`.
- [ ] Share token chỉ nằm trong fragment/header/socket auth, không đặt vào query, log hoặc analytics.
