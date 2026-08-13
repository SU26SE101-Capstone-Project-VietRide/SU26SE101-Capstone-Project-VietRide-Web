# Audit search/filter giữa FE và BE

> **ĐÃ THAY THẾ (2026-08-13).** Dùng `BE_SEARCH_FILTER_GAP_2026-08-13.md` — bản đó
> soát đủ 27 màn, có mức ưu tiên và đã đối chiếu tới tận handler của BE. File này
> giữ lại làm lịch sử, chỉ soát một phần.

> Ngày kiểm tra: 2026-08-13  
> Phạm vi: các màn hình dạng bảng/list trong `vietride/src`.  
> Lưu ý: file này chỉ là checklist/đề nghị đối chiếu cho BE. Không sửa source BE.

## Kết luận nhanh

Hiện trạng không đồng nhất:

1. Một số màn hình đã gọi API với search/filter server-side đúng.
2. Một số màn hình có UI search/filter nhưng FE tải toàn bộ dữ liệu rồi lọc/phân trang ở client. Với dữ liệu lớn, tổng số bản ghi và phân trang không còn phản ánh đúng dữ liệu BE.
3. Lịch chạy đang gửi một số query mà BE hiện chưa nhận/xử lý.
4. Có các filter UI là nghiệp vụ riêng của FE nhưng endpoint BE chưa có tham số tương ứng.

## 1. Các vấn đề BE cần xử lý

### 1.1. Danh sách lịch chạy của operator

FE: `src/pages/Manager/Trips/index.tsx`  
API: `GET /v1/operator/driver-schedules`

FE đang gửi:

```text
page, pageSize, search, isActive, vehicleTypeId
```

FE còn dùng `isOneTime=true` để tính stat.

BE hiện nhận/xử lý:

```text
page, pageSize, routeId, driverUserId, isActive
```

Handler hiện lọc theo operator, route, driver và `isActive`; chưa có xử lý cho:

- `search`
- `vehicleTypeId`
- `isOneTime`

Đề nghị BE:

- Bổ sung `search`, tìm theo các field nghiệp vụ đã thống nhất, tối thiểu nên nói rõ có tìm theo tên tuyến, tên tài xế hay không.
- Bổ sung `vehicleTypeId` và join/filter theo loại xe của phương tiện được gắn với lịch.
- Xác nhận nghiệp vụ `isOneTime`; nếu có thì thêm vào request/handler, nếu không có thì FE sẽ bỏ stat/filter này.
- Trả `totalItems`, `totalPages` sau khi áp dụng toàn bộ filter.

Tham chiếu BE: `OperatorDriverSchedulesController`, `ListDriverSchedulesQuery`, `ListDriverSchedulesHandler`.

### 1.2. Danh sách tuyến operator

FE có nơi gửi `status`:

```text
GET /v1/operator/routes?page=...&pageSize=...&search=...&status=...
```

Controller BE hiện thể hiện rõ `search`, còn trạng thái đang được biểu diễn bằng `isActive` ở một số contract/handler.

Đề nghị BE xác nhận một contract duy nhất:

- dùng `isActive=true|false`, hoặc
- dùng `status=ACTIVE|INACTIVE`.

Nếu chọn `status`, cần bảo đảm endpoint thực sự bind và filter, không silently ignore. FE sẽ map theo contract được BE chốt.

### 1.3. API danh sách voucher admin

FE hiện có UI search theo `code/name/description`, filter trạng thái và service, nhưng đang dùng `fetchAllPages` rồi lọc client-side.

Contract FE hiện khai báo các tham số BE có thể nhận:

```text
page, pageSize, search, sortBy, sortDir,
ownerOperatorId, fundingType, isActive
```

Đề nghị BE xác nhận:

- `search` tìm trên code, name, description hay field nào;
- `isActive` có filter đúng không;
- `ownerOperatorId` và `fundingType` có filter đúng không;
- service `BOOKING/PARCEL` có được hỗ trợ server-side hay không. Nếu chưa, cần bổ sung tham số, ví dụ `service` hoặc `applicableService`.

FE cần chuyển sang gửi các tham số này và bỏ lọc/phân trang client-side sau khi contract được chốt.

## 2. Các trường hợp BE đã hỗ trợ nhưng FE chưa tận dụng đúng

### 2.1. Admin Locations

FE: `src/pages/Admin/Locations/index.tsx`  
API: `GET /v1/admin/locations`

BE hỗ trợ:

```text
page, pageSize, search, isActive
```

FE hiện tải toàn bộ trang bằng `fetchAllAdminLocations()`, sau đó client filter:

- search theo code/name;
- trạng thái;
- loại hành chính (`type`);
- tỉnh cha (`parentCode`);
- phân trang.

Vấn đề: BE chưa hỗ trợ `type` và `parentCode`, nên FE mới tải toàn bộ để lọc. Đề nghị BE bổ sung:

```text
type, parentCode
```

Sau đó FE chuyển sang gọi một trang theo query và dùng metadata phân trang của BE. Nếu BE không muốn bổ sung hai filter này, cần ghi rõ đây là filter client-side có chủ đích và không dùng cho dataset lớn.

### 2.2. Admin Stations

FE: `src/pages/Admin/Stations/index.tsx`  
API: `GET /v1/admin/stations`

BE hỗ trợ:

```text
page, pageSize, search, isActive
```

FE hiện tải toàn bộ dữ liệu rồi client filter:

- search theo name, slug, địa chỉ, ward;
- active/inactive;
- có hỗ trợ shuttle/không hỗ trợ shuttle;
- phân trang.

Đề nghị BE bổ sung filter `supportsShuttle` nếu đây là filter nghiệp vụ cần giữ. Search nên xác nhận rõ các field được tìm kiếm. Sau khi đó FE nên gửi query server-side thay vì `fetchAllPages`.

### 2.3. Manager Routes - sidebar danh sách tuyến

FE: `src/pages/Manager/Routes/RouteListSidebar.tsx` và `src/pages/Manager/Routes/index.tsx`.

BE `GET /v1/operator/routes` đã hỗ trợ `search`. Tuy nhiên FE gọi `fetchAllPages(getOperatorRoutes)` và sidebar dùng:

```ts
routes.filter((route) => route.name.toLowerCase().includes(query))
```

Đây là filter client-side trong khi BE đã có search. FE cần chuyển query sidebar sang API hoặc thống nhất đây là một danh sách master-data nhỏ được preload có chủ đích.

### 2.4. Admin Vouchers

Như mục 1.3: BE có contract phân trang/search/status-related params, nhưng FE đang tải toàn bộ rồi lọc. Đây chủ yếu là việc FE cần sửa sau khi BE xác nhận contract `service`.

### 2.5. Bảng cước parcel route fare

FE: `src/pages/Manager/Parcels/index.tsx`  
API: `GET /v1/operator/parcel-route-fares`

BE hỗ trợ:

```text
page, pageSize, routeId, sizeCategory
```

FE hiện tải toàn bộ rồi client:

- search theo tên tuyến;
- filter size category;
- sort theo giá tăng/giảm;
- phân trang.

`sizeCategory` và `routeId` có thể gửi BE. Search theo tên tuyến cần BE hỗ trợ `search` hoặc FE phải lấy route theo search rồi truyền `routeId`. Sort theo `priceVnd` cần BE hỗ trợ `sortBy=priceVnd&sortDir=asc|desc` nếu muốn server-side hoàn toàn.

Đề nghị BE xác nhận/bổ sung:

```text
search, sortBy, sortDir
```

và bảo đảm `routeId`, `sizeCategory` được filter trước khi tính tổng/phân trang.

## 3. Các màn hình hiện đang gọi server-side đúng

Các màn hình dưới đây FE đã gửi query lên API và sử dụng metadata phân trang từ response; chưa thấy lỗi tải toàn bộ rồi lọc lại trong phần list chính:

| Màn hình | API | Query FE đang dùng |
|---|---|---|
| Admin Users | `/v1/admin/users` | `search`, `role`, `status`, `page`, `pageSize`, sort |
| Manager Staff | `/v1/operator/users` | `search`, `role`, `status`, `page`, `pageSize` |
| Manager Vehicles | `/v1/operator/vehicles` | `search`, `searchIn=licensePlate`, `status`, `vehicleTypeId`, phân trang |
| Manager Bookings | `/v1/operator/bookings` | `bookingCode`, `status`, `page`, `pageSize` |
| Manager Incidents | `/v1/operator/incidents` | `category`, `status`, `tripId`, `from`, `to`, phân trang |
| Manager Parcel Queue | `/v1/operator/parcels` | `status`, `pendingActionType`, `tripId`, phân trang |
| Manager Wallet - transactions | wallet transactions | `search`, `dateField`, `from`, `to`, `type`, sort, phân trang |
| Manager Wallet - settlements | trip settlements | `search`, `dateField`, `from`, `to`, `status`, sort, phân trang |
| Manager Wallet - ledger | ledger | `search`, `dateField`, `from`, `to`, sort, phân trang |
| Manager Route Management | `/v1/operator/routes` | `search`, trạng thái, phân trang; cần chốt `status`/`isActive` như mục 1.2 |

Lưu ý về stat trên các màn hình: nhiều stat đang đếm số dòng của trang hiện tại, không phải tổng theo toàn bộ dataset. Nếu stat cần là tổng hệ thống/toàn bộ kết quả filter, nên dùng aggregate endpoint hoặc BE trả aggregate riêng; không nên suy ra từ `items` của một page.

## 4. Các trường hợp cần FE sửa, không phải BE sửa

### 4.1. Admin Operators

FE đã gửi `search` và `status` lên API `/v1/admin/operators`, nhưng sau khi nhận response lại filter tiếp theo `operator.name` và slice lại ở client.

Hậu quả:

- kết quả bị filter hai lần;
- pagination/total không còn đồng nhất với BE;
- search client chỉ xét `name`, có thể khác phạm vi search của BE.

FE nên render trực tiếp `items` và dùng `totalItems` từ BE.

### 4.2. Driver schedules

Ngoài phần BE thiếu query ở mục 1.1, FE không nên hiển thị hoặc tính stat dựa trên `isOneTime` cho tới khi BE xác nhận field nghiệp vụ này tồn tại.

### 4.3. Các bảng tải toàn bộ bằng `fetchAllPages`

Các màn hình cần FE xem lại việc preload toàn bộ và filter client-side:

- Admin Locations;
- Admin Stations;
- Admin Vouchers;
- Manager Routes sidebar;
- Manager Parcels - route fare table.

`fetchAllPages` chỉ nên giữ cho option list/master data nhỏ hoặc khi BE chưa có filter cần thiết; không nên dùng cho bảng có search/filter và phân trang hiển thị cho người dùng.

## 5. Danh sách tham số BE cần xác nhận trong tài liệu API

| Endpoint | Tham số cần xác nhận/bổ sung | Lý do |
|---|---|---|
| `/v1/operator/driver-schedules` | `search`, `vehicleTypeId`, `isOneTime` | FE đang gửi/dùng nhưng BE hiện chưa xử lý |
| `/v1/operator/routes` | `status` hay `isActive` | FE và BE đang có hai cách biểu diễn trạng thái |
| `/v1/admin/locations` | `type`, `parentCode` | FE có filter nhưng BE hiện chưa nhận |
| `/v1/admin/stations` | `supportsShuttle` | FE có filter shuttle nhưng endpoint mới thể hiện search/isActive |
| `/v1/admin/vouchers` | service/applicable service filter | FE có filter BOOKING/PARCEL nhưng contract hiện chưa rõ |
| `/v1/operator/parcel-route-fares` | `search`, `sortBy`, `sortDir` | FE có search/sort bảng cước |

## 6. Tiêu chí nghiệm thu sau khi BE cập nhật

- Query không được silently ignore; tham số không hỗ trợ phải được loại khỏi FE hoặc được BE document rõ.
- Search/filter phải được áp dụng trước `totalItems`, `totalPages`, `hasNextPage`.
- Search nên có quy tắc rõ ràng: field nào, contains/prefix/exact, có không phân biệt hoa thường/bỏ dấu hay không.
- Status phải có enum/giá trị thống nhất giữa FE và BE.
- Sort phải whitelist field hợp lệ và có default order ổn định.
- Khi không truyền filter, response vẫn trả pagination metadata nhất quán.
- Với các filter theo quan hệ như loại xe, tỉnh cha, service, BE cần filter bằng ID/enum nghiệp vụ chứ không dựa vào text hiển thị.

## Tài liệu/source đã đối chiếu

FE:

- `src/pages/Manager/Trips/index.tsx`
- `src/pages/Manager/RouteManagement/index.tsx`
- `src/pages/Manager/Routes/index.tsx`
- `src/pages/Manager/Routes/RouteListSidebar.tsx`
- `src/pages/Manager/Vehicles/index.tsx`
- `src/pages/Manager/Staff/index.tsx`
- `src/pages/Manager/Bookings/index.tsx`
- `src/pages/Manager/Parcels/index.tsx`
- `src/pages/Manager/Parcels/ParcelQueue.tsx`
- `src/pages/Manager/Incidents/index.tsx`
- `src/pages/Manager/Wallet/index.tsx`
- `src/pages/Manager/Packages/OperatorInvoiceSection.tsx`
- `src/pages/Manager/Dispatch/index.tsx`
- `src/pages/Admin/Operators/index.tsx`
- `src/pages/Admin/Users.tsx`
- `src/pages/Admin/Locations/index.tsx`
- `src/pages/Admin/Stations/index.tsx`
- `src/pages/Admin/Vouchers/index.tsx`
- `src/api/vietride.ts`

BE đã đọc để đối chiếu, không chỉnh sửa:

- controllers/handlers của driver schedules, routes, vehicles, users, bookings, parcels, incidents, financial lists, stations và locations trong `SU26SE101-Capstone-Project-VietRide-BE/apps`.

