# API Polyline — Route Path Geometry

Tài liệu này dành cho FE/Mobile và AI Agent consume phần API **lưu tuyến đường thực tế trên map** vừa implement theo `docs/handoff/2026-07-07-route-path-polyline-design.md`.

Nguyên tắc của file này: chỉ ghi hành vi đã có trong code hiện tại. Những điểm chưa chắc chắn được ghi rõ bằng `⚠️ TODO`.

Swagger online do BE lead cung cấp: <https://api.vietride.online/docs>

## Mục lục

- [Base URL](#base-url)
- [Xác thực](#xác-thực)
- [Response wrapper chuẩn](#response-wrapper-chuẩn)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [DTO chính](#dto-chính)
- [Validation polyline](#validation-polyline)
- [Endpoint chi tiết](#endpoint-chi-tiết)
  - [GET /v1/operator/routes](#get-v1operatorroutes)
  - [GET /v1/operator/routes/{id}](#get-v1operatorroutesid)
  - [PUT /v1/operator/routes/{id}/geometry](#put-v1operatorroutesidgeometry)
  - [GET /v1/operator/routes/{id}/alternative-routes](#get-v1operatorroutesidalternative-routes)
  - [PUT /v1/operator/alternative-routes/{id}/geometry](#put-v1operatoralternative-routesidgeometry)
- [Side effects cần FE biết](#side-effects-cần-fe-biết)
- [Flow FE khuyến nghị](#flow-fe-khuyến-nghị)

## Base URL

| Môi trường | Base URL | Nguồn |
|---|---|---|
| Local Gateway | `http://localhost:3000` | `.env.example`, `apps/gateway/src/config/env.schema.ts`, `infra/docker/README.md` |
| Local Trip service trực tiếp | `http://localhost:5002` | `.env.example`, `apps/trip/src/VietRide.Trip.Api/appsettings*.json` |
| Swagger online | `https://api.vietride.online/docs` | User cung cấp |

⚠️ TODO: cần xác nhận thêm production API base URL có phải `https://api.vietride.online` hay không. FE nên ưu tiên gọi qua Gateway, không gọi thẳng Trip service.

Ví dụ trong tài liệu:

```bash
BASE_URL=http://localhost:3000
ACCESS_TOKEN=<operator-admin-access-token>
```

## Xác thực

FE gọi các endpoint operator qua Gateway với header:

| Header | Bắt buộc | Giá trị |
|---|---:|---|
| `Authorization` | Có | `Bearer <User Access Token>` |
| `Content-Type` | Có với request có body | `application/json` |

Gateway verify User Access Token:

| Thuộc tính | Giá trị trong code/config |
|---|---|
| Algorithm | `RS256` |
| Issuer | `vietride-identity` |
| Audience | `vietride-api` |
| JWKS env | `JWT_PUBLIC_KEY_URL` |

Sau khi verify, Gateway mint Internal JWT và gọi Trip service bằng `X-Internal-Auth`. FE không tự gửi header này.

Role thực tế:

| API | Quyền |
|---|---|
| `GET /v1/operator/routes` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| `GET /v1/operator/routes/{id}` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| `GET /v1/operator/routes/{id}/alternative-routes` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| `PUT /v1/operator/routes/{id}/geometry` | `OPERATOR_ADMIN` |
| `PUT /v1/operator/alternative-routes/{id}/geometry` | `OPERATOR_ADMIN` |

Nếu token thiếu/sai/hết hạn ở Gateway:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "AUTH_TOKEN_INVALID",
    "message": "Authorization header is required or access token is invalid."
  },
  "meta": {
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.000Z"
  }
}
```

## Response wrapper chuẩn

FE-facing success response được wrap dạng:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.0000000Z"
  }
}
```

FE-facing error response:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "ROUTE_GEOMETRY_INVALID",
    "message": "Route geometry is not a valid Google encoded polyline with 2 to 10,000 points.",
    "fields": [
      {
        "field": "pathPolyline",
        "message": "Route geometry is invalid."
      }
    ]
  },
  "meta": {
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.0000000Z"
  }
}
```

Ghi chú:

- JSON serialize camelCase.
- `message` trong success wrapper có thể không xuất hiện.
- `error.fields` có thể không xuất hiện nếu lỗi không có field-level errors.
- `DateTimeOffset` trả ISO-8601 string.

## Tổng quan endpoint

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/v1/operator/routes` | List route của operator. Không trả `pathPolyline`. |
| `GET` | `/v1/operator/routes/{id}` | Detail route. Có trả `pathPolyline`. |
| `PUT` | `/v1/operator/routes/{id}/geometry` | Lưu/xóa polyline tuyến chính. |
| `GET` | `/v1/operator/routes/{id}/alternative-routes` | List alternative route. Không trả `pathPolyline`. |
| `PUT` | `/v1/operator/alternative-routes/{id}/geometry` | Lưu/xóa polyline tuyến thay thế. |

Các endpoint mutation polyline **không yêu cầu** `Idempotency-Key` theo code/contract hiện tại.

## DTO chính

### RouteDto

`RouteDto` dùng cho detail/mutation response và có `pathPolyline`.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "operatorId": "22222222-2222-2222-2222-222222222222",
  "name": "Da Nang to Hue",
  "originStationId": "33333333-3333-3333-3333-333333333333",
  "destinationStationId": "44444444-4444-4444-4444-444444444444",
  "returnRouteId": null,
  "baseFare": 250000,
  "totalDistanceKm": 100.5,
  "estimatedDurationMinutes": 180,
  "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "isActive": true,
  "createdAt": "2026-07-10T00:00:00.0000000Z",
  "updatedAt": "2026-07-10T00:00:00.0000000Z"
}
```

| Field | Type | Nullable | Ghi chú |
|---|---|---:|---|
| `id` | UUID string | Không | Route id. |
| `operatorId` | UUID string | Không | Operator owner. |
| `name` | string | Không | Tên tuyến. |
| `originStationId` | UUID string | Không | Bến/station xuất phát. |
| `destinationStationId` | UUID string | Không | Bến/station đến. |
| `returnRouteId` | UUID string | Có | Tuyến chiều về nếu có. |
| `baseFare` | integer | Không | VND. |
| `totalDistanceKm` | decimal | Có | Tổng km. |
| `estimatedDurationMinutes` | integer | Có | Phút. |
| `pathPolyline` | string | Có | Google encoded polyline precision-5. `null` nghĩa là chưa có hoặc đã clear. |
| `isActive` | boolean | Không | Active flag. |
| `createdAt` | ISO datetime string | Không |  |
| `updatedAt` | ISO datetime string | Không |  |

### RouteListItemDto

List route không trả `pathPolyline` để tránh payload lớn.

Fields giống `RouteDto` nhưng **không có** `pathPolyline`.

### AlternativeRouteDto

`AlternativeRouteDto` dùng cho mutation response và có `pathPolyline`.

```json
{
  "id": "55555555-5555-5555-5555-555555555555",
  "routeId": "11111111-1111-1111-1111-111111111111",
  "name": "Avoid highway",
  "description": "Route via coastal road",
  "destinationStationId": "44444444-4444-4444-4444-444444444444",
  "totalDistanceKm": 105.2,
  "estimatedDurationMinutes": 195,
  "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "isActive": true,
  "stops": [
    {
      "alternativeRouteId": "55555555-5555-5555-5555-555555555555",
      "stopId": "66666666-6666-6666-6666-666666666666",
      "orderIndex": 1,
      "estimatedDurationFromOriginMinutes": 60,
      "distanceFromOriginKm": 35.5,
      "createdAt": "2026-07-10T00:00:00.0000000Z",
      "updatedAt": "2026-07-10T00:00:00.0000000Z"
    }
  ],
  "createdAt": "2026-07-10T00:00:00.0000000Z",
  "updatedAt": "2026-07-10T00:00:00.0000000Z"
}
```

### AlternativeRouteListItemDto

List alternative route không trả `pathPolyline`.

Fields giống `AlternativeRouteDto` nhưng **không có** `pathPolyline`.

⚠️ TODO: trong controller hiện tại chưa thấy endpoint `GET /v1/operator/alternative-routes/{id}` để lấy detail alternative route riêng. FE nếu reload màn hình alternative route từ list sẽ không nhận được `pathPolyline` từ list.

## Validation polyline

Áp dụng cho:

- `PUT /v1/operator/routes/{id}/geometry`
- `PUT /v1/operator/alternative-routes/{id}/geometry`

Request body:

```json
{
  "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
}
```

Clear geometry:

```json
{
  "pathPolyline": null
}
```

Rules theo code:

| Rule | Giá trị |
|---|---|
| Format | Google encoded polyline precision-5 |
| Max size | `Encoding.UTF8.GetByteCount(pathPolyline) <= 102400` |
| Point count | Từ `2` đến `10000` điểm sau decode |
| Latitude | `[-90, 90]` |
| Longitude | `[-180, 180]` |
| Waypoint matching | Mọi stop/station được kiểm tra phải cách polyline tối đa `500m` |

Với route chính, BE kiểm tra:

- các `RouteStop` của route;
- `originStationId`;
- `destinationStationId`;
- station chỉ được check nếu có cả latitude và longitude.

Với alternative route, BE kiểm tra:

- stops của alternative route;
- origin station của parent route;
- destination station của alternative route;
- station chỉ được check nếu có cả latitude và longitude.

Error codes:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 422 | `ROUTE_GEOMETRY_TOO_LARGE` | Encoded string vượt `102400` bytes UTF-8. |
| 422 | `ROUTE_GEOMETRY_INVALID` | Decode fail, ký tự không hợp lệ, truncated/overflow, số điểm ngoài `2..10000`, hoặc lat/lng ngoài range. |
| 422 | `ROUTE_GEOMETRY_STOP_MISMATCH` | Stop/station cách polyline hơn `500m`. |

Mẫu lỗi mismatch:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "ROUTE_GEOMETRY_STOP_MISMATCH",
    "message": "One or more route stops or stations are farther than 500 meters from the route geometry.",
    "fields": [
      {
        "field": "stopIds",
        "message": "66666666-6666-6666-6666-666666666666,77777777-7777-7777-7777-777777777777"
      },
      {
        "field": "stationIds",
        "message": "33333333-3333-3333-3333-333333333333"
      }
    ]
  },
  "meta": {
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.0000000Z"
  }
}
```

FE parse:

- `stopIds`: chuỗi UUID phân cách bằng dấu phẩy.
- `stationIds`: chuỗi UUID phân cách bằng dấu phẩy.
- Field nào không có mismatch thì không xuất hiện.

## Endpoint chi tiết

### GET /v1/operator/routes

Lấy danh sách route. Không trả `pathPolyline`.

```text
GET {BASE_URL}/v1/operator/routes
```

Headers:

| Header | Bắt buộc | Giá trị |
|---|---:|---|
| `Authorization` | Có | `Bearer <ACCESS_TOKEN>` |

Query params:

| Param | Type | Bắt buộc | Default theo handler | Ghi chú |
|---|---|---:|---:|---|
| `page` | integer | Không | `1` |  |
| `pageSize` | integer | Không | `20` | Handler clamp tối đa `100`. |
| `search` | string | Không | null | Trim rồi filter `route.Name.Contains(search)`. |

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "operatorId": "22222222-2222-2222-2222-222222222222",
        "name": "Da Nang to Hue",
        "originStationId": "33333333-3333-3333-3333-333333333333",
        "destinationStationId": "44444444-4444-4444-4444-444444444444",
        "returnRouteId": null,
        "baseFare": 250000,
        "totalDistanceKm": 100.5,
        "estimatedDurationMinutes": 180,
        "isActive": true,
        "createdAt": "2026-07-10T00:00:00.0000000Z",
        "updatedAt": "2026-07-10T00:00:00.0000000Z"
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
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.0000000Z"
  }
}
```

curl:

```bash
curl -X GET "$BASE_URL/v1/operator/routes?page=1&pageSize=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

fetch:

```js
const res = await fetch(`${BASE_URL}/v1/operator/routes?page=1&pageSize=20`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const body = await res.json();
```

axios:

```js
const { data } = await axios.get(`${BASE_URL}/v1/operator/routes`, {
  params: { page: 1, pageSize: 20 },
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

### GET /v1/operator/routes/{id}

Lấy detail route. Có trả `pathPolyline`.

```text
GET {BASE_URL}/v1/operator/routes/{id}
```

Path params:

| Param | Type | Bắt buộc |
|---|---|---:|
| `id` | UUID | Có |

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "operatorId": "22222222-2222-2222-2222-222222222222",
    "name": "Da Nang to Hue",
    "originStationId": "33333333-3333-3333-3333-333333333333",
    "destinationStationId": "44444444-4444-4444-4444-444444444444",
    "returnRouteId": null,
    "baseFare": 250000,
    "totalDistanceKm": 100.5,
    "estimatedDurationMinutes": 180,
    "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    "isActive": true,
    "createdAt": "2026-07-10T00:00:00.0000000Z",
    "updatedAt": "2026-07-10T00:00:00.0000000Z"
  },
  "meta": {
    "traceId": "string",
    "timestamp": "2026-07-10T00:00:00.0000000Z"
  }
}
```

Errors:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Token thiếu/sai/hết hạn. |
| 403 | `FORBIDDEN` | Role/operator scope không hợp lệ. |
| 404 | `ROUTE_NOT_FOUND` | Route không tồn tại hoặc không thuộc operator hiện tại. |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được Trip service. |

curl:

```bash
curl -X GET "$BASE_URL/v1/operator/routes/$ROUTE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

fetch:

```js
const res = await fetch(`${BASE_URL}/v1/operator/routes/${routeId}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const body = await res.json();
const pathPolyline = body.data.pathPolyline;
```

axios:

```js
const { data } = await axios.get(`${BASE_URL}/v1/operator/routes/${routeId}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const pathPolyline = data.data.pathPolyline;
```

### PUT /v1/operator/routes/{id}/geometry

Lưu hoặc xóa polyline tuyến chính.

```text
PUT {BASE_URL}/v1/operator/routes/{id}/geometry
```

Headers:

| Header | Bắt buộc | Giá trị |
|---|---:|---|
| `Authorization` | Có | `Bearer <ACCESS_TOKEN>` |
| `Content-Type` | Có | `application/json` |

Path params:

| Param | Type | Bắt buộc |
|---|---|---:|
| `id` | UUID | Có |

Request body:

```json
{
  "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
}
```

Clear:

```json
{
  "pathPolyline": null
}
```

Response `200`: `RouteDto` có `pathPolyline` đã cập nhật.

Errors:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON/type mismatch/model binding lỗi. |
| 401 | `AUTH_TOKEN_INVALID` | Token thiếu/sai/hết hạn. |
| 403 | `FORBIDDEN` | Không phải `OPERATOR_ADMIN`, thiếu operator scope, hoặc operator không được write. |
| 404 | `ROUTE_NOT_FOUND` | Route không tồn tại hoặc cross-operator. |
| 422 | `ROUTE_GEOMETRY_TOO_LARGE` | Polyline vượt `102400` bytes. |
| 422 | `ROUTE_GEOMETRY_INVALID` | Polyline không decode được hoặc points/range không hợp lệ. |
| 422 | `ROUTE_GEOMETRY_STOP_MISMATCH` | Stop/station cách polyline hơn `500m`. |
| 422 | `VALIDATION_ERROR` | Validation khác hoặc Identity logical-FK validation failure không phải 403. |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được Trip service. |

curl:

```bash
curl -X PUT "$BASE_URL/v1/operator/routes/$ROUTE_ID/geometry" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pathPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@"}'
```

fetch:

```js
const res = await fetch(`${BASE_URL}/v1/operator/routes/${routeId}/geometry`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ pathPolyline }),
});

const body = await res.json();
if (!res.ok && body.error?.code === 'ROUTE_GEOMETRY_STOP_MISMATCH') {
  const fields = Object.fromEntries(
    (body.error.fields ?? []).map((item) => [item.field, item.message]),
  );
  const stopIds = fields.stopIds ? fields.stopIds.split(',') : [];
  const stationIds = fields.stationIds ? fields.stationIds.split(',') : [];
  console.log({ stopIds, stationIds });
}
```

axios:

```js
const { data } = await axios.put(
  `${BASE_URL}/v1/operator/routes/${routeId}/geometry`,
  { pathPolyline },
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
```

### GET /v1/operator/routes/{id}/alternative-routes

List alternative routes của route. Không trả `pathPolyline`.

```text
GET {BASE_URL}/v1/operator/routes/{id}/alternative-routes
```

Path params:

| Param | Type | Bắt buộc |
|---|---|---:|
| `id` | UUID | Có |

Query params:

| Param | Type | Bắt buộc | Default theo handler |
|---|---|---:|---:|
| `page` | integer | Không | `1` |
| `pageSize` | integer | Không | `20`, clamp tối đa `100` |

Response `200`: `PagedResult<AlternativeRouteListItemDto>` trong `data`, không có `pathPolyline`.

Errors:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Token thiếu/sai/hết hạn. |
| 403 | `FORBIDDEN` | Role/operator scope không hợp lệ. |
| 404 | `ROUTE_NOT_FOUND` | Parent route không tồn tại hoặc cross-operator. |
| 422 | `VALIDATION_ERROR` | Query validation lỗi. |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được Trip service. |

curl:

```bash
curl -X GET "$BASE_URL/v1/operator/routes/$ROUTE_ID/alternative-routes?page=1&pageSize=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

fetch:

```js
const res = await fetch(
  `${BASE_URL}/v1/operator/routes/${routeId}/alternative-routes?page=1&pageSize=20`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
const body = await res.json();
```

axios:

```js
const { data } = await axios.get(
  `${BASE_URL}/v1/operator/routes/${routeId}/alternative-routes`,
  {
    params: { page: 1, pageSize: 20 },
    headers: { Authorization: `Bearer ${accessToken}` },
  },
);
```

### PUT /v1/operator/alternative-routes/{id}/geometry

Lưu hoặc xóa polyline tuyến thay thế.

```text
PUT {BASE_URL}/v1/operator/alternative-routes/{id}/geometry
```

Path params:

| Param | Type | Bắt buộc | Ghi chú |
|---|---|---:|---|
| `id` | UUID | Có | Alternative route id. |

Request body:

```json
{
  "pathPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
}
```

Clear:

```json
{
  "pathPolyline": null
}
```

Response `200`: `AlternativeRouteDto` có `pathPolyline` đã cập nhật.

Errors:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON/type mismatch/model binding lỗi. |
| 401 | `AUTH_TOKEN_INVALID` | Token thiếu/sai/hết hạn. |
| 403 | `FORBIDDEN` | Không phải `OPERATOR_ADMIN`, thiếu operator scope, hoặc operator không được write. |
| 404 | `ROUTE_NOT_FOUND` | Alternative route không tồn tại/cross-operator, hoặc parent route không tìm thấy. |
| 422 | `ROUTE_GEOMETRY_TOO_LARGE` | Polyline vượt `102400` bytes. |
| 422 | `ROUTE_GEOMETRY_INVALID` | Polyline không decode được hoặc points/range không hợp lệ. |
| 422 | `ROUTE_GEOMETRY_STOP_MISMATCH` | Alternative stop, parent origin station, hoặc alternative destination station cách polyline hơn `500m`. |
| 422 | `VALIDATION_ERROR` | Validation khác hoặc Identity logical-FK validation failure không phải 403. |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được Trip service. |

curl:

```bash
curl -X PUT "$BASE_URL/v1/operator/alternative-routes/$ALTERNATIVE_ROUTE_ID/geometry" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pathPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@"}'
```

fetch:

```js
const res = await fetch(
  `${BASE_URL}/v1/operator/alternative-routes/${alternativeRouteId}/geometry`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pathPolyline }),
  },
);
const body = await res.json();
```

axios:

```js
const { data } = await axios.put(
  `${BASE_URL}/v1/operator/alternative-routes/${alternativeRouteId}/geometry`,
  { pathPolyline },
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
```

## Side effects cần FE biết

BE tự clear polyline cũ để tránh vẽ sai tuyến khi shape route đổi.

| Action | API | Side effect |
|---|---|---|
| Thêm stop vào route | `POST /v1/operator/routes/{id}/stops` | Set `Route.pathPolyline = null`. |
| Xóa stop khỏi route | `DELETE /v1/operator/routes/{id}/stops/{stopId}` | Set `Route.pathPolyline = null`. |
| Patch alternative route với `hasStops = true` | `PATCH /v1/operator/alternative-routes/{id}` | Set `AlternativeRoute.pathPolyline = null`. |
| Patch alternative route đổi destination | `PATCH /v1/operator/alternative-routes/{id}` | Set `AlternativeRoute.pathPolyline = null` nếu `destinationStationId` khác giá trị hiện tại. |
| Patch alternative route chỉ đổi name/description/distance/duration/isActive | `PATCH /v1/operator/alternative-routes/{id}` | Không clear polyline. |

## Flow FE khuyến nghị

1. FE/operator tạo route, tạo stops, tạo alternative route như flow hiện tại.
2. FE gọi Google Directions/Map provider để lấy Google encoded polyline precision-5.
3. FE gọi:
   - `PUT /v1/operator/routes/{id}/geometry` cho tuyến chính;
   - hoặc `PUT /v1/operator/alternative-routes/{id}/geometry` cho tuyến thay thế.
4. Nếu response lỗi `ROUTE_GEOMETRY_STOP_MISMATCH`, FE parse `error.fields` để lấy `stopIds` và/hoặc `stationIds`, rồi highlight điểm bị lệch trên UI.
5. Khi hiển thị tuyến chính trên map:
   - gọi `GET /v1/operator/routes/{id}`;
   - lấy `data.pathPolyline`;
   - decode polyline ở FE để vẽ line trên map.
6. Nếu `pathPolyline == null`, FE nên hiển thị trạng thái “chưa có đường đi thực tế” và fallback vẽ line theo stops/stations nếu muốn.
7. Sau khi thêm/xóa stops hoặc đổi shape alternative route, BE clear polyline; FE cần yêu cầu operator gửi lại polyline mới.

## Nguồn code đã rà

- `apps/gateway/src/config/routes.ts`
- `apps/gateway/src/proxy/proxy.middleware.ts`
- `apps/gateway/src/auth/user-jwt.verifier.ts`
- `apps/gateway/src/auth/internal-jwt.signer.ts`
- `libs/dotnet/VietRide.Shared.Kernel/Primitives/ApiResponse.cs`
- `libs/dotnet/VietRide.Shared.Kernel/Primitives/PagedResult.cs`
- `libs/dotnet/VietRide.Shared.Web/Filters/ApiResponseResultFilter.cs`
- `libs/dotnet/VietRide.Shared.Web/Filters/ApiResponseExceptionFilter.cs`
- `apps/trip/src/VietRide.Trip.Api/Controllers/OperatorRoutesController.cs`
- `apps/trip/src/VietRide.Trip.Api/Controllers/OperatorAlternativeRoutesController.cs`
- `apps/trip/src/VietRide.Trip.Api/Controllers/Requests/SetRouteGeometryRequest.cs`
- `apps/trip/src/VietRide.Trip.Application/Features/Routes/SetRouteGeometryHandler.cs`
- `apps/trip/src/VietRide.Trip.Application/Features/AlternativeRoutes/SetAlternativeRouteGeometryHandler.cs`
- `apps/trip/src/VietRide.Trip.Application/Common/Geometry/RouteGeometryValidator.cs`
- `apps/trip/src/VietRide.Trip.Application/Common/Geometry/PolylineCodec.cs`
- `apps/trip/src/VietRide.Trip.Application/Common/Geometry/GeoDistance.cs`

