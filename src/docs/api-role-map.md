# VietRide API Role Map

This note maps the Swagger screenshots to frontend usage.

## System Admin

- `GET /v1/admin/operators`: list operator applications/companies.
- `POST /v1/admin/operators`: create an operator from the admin console.
- `POST /v1/admin/operators/{operatorId}/approve`: approve a pending operator.
- `POST /v1/admin/operators/{operatorId}/reject`: reject a pending operator with a reason.
- `POST /v1/admin/operators/{operatorId}/suspend`: suspend an approved operator with a reason.
- `GET /v1/admin/operator-users`: list users across operators.
- `POST /v1/admin/users`: create an admin-managed user.
- `GET /v1/admin/users`: list, filter, sort and page users, including soft-deleted records when explicitly requested.
- `POST /v1/admin/users/{userId}/lock`: lock a user and revoke active refresh tokens. Requires `Idempotency-Key`.
- `POST /v1/admin/users/{userId}/unlock`: restore the user's status before lock. Requires `Idempotency-Key`.
- `GET /v1/admin/activity-logs`: query administrative audit logs by actor, action and UTC range.
- `GET /v1/admin/stations`: list platform stations.
- `PATCH /v1/admin/stations/{stationId}`: normalize platform station data.
- `POST /v1/admin/stations/{primaryStationId}/merge`: merge a duplicate station into the canonical station. Requires `Idempotency-Key`.
- `GET /v1/admin/reports/platform`: aggregate completed bookings, trips, delivered parcels and earned revenue in a strict UTC range.

## Operator Admin / Manager

- `GET /v1/operator/profile`: read current operator profile.
- `PATCH /v1/operator/profile`: update current operator profile.
- `GET /v1/operator/users`: list staff/users in the current operator.
- `POST /v1/operator/users`: create operator staff.
- `POST /v1/operator/users/{userId}/resend-initial-password`: resend first-login password email.
- `GET /v1/operator/routes`: list operator routes.
- `POST /v1/operator/routes`: create a route.
- `GET /v1/operator/routes/{id}`: get route detail.
- `PATCH /v1/operator/routes/{id}`: update a route.
- `POST /v1/operator/routes/{id}/stops`: add a stop to a route.
- `DELETE /v1/operator/routes/{id}/stops/{stopId}`: remove a stop from a route.
- `GET /v1/operator/routes/{id}/fare-templates`: list future/override fares for route stops.
- `POST /v1/operator/routes/{id}/fare-templates`: create a route stop fare override.
- `GET /v1/operator/routes/{id}/alternative-routes`: list alternative routes.
- `POST /v1/operator/routes/{id}/alternative-routes`: create an alternative route.
- `PATCH /v1/operator/alternative-routes/{id}`: update an alternative route.
- `DELETE /v1/operator/alternative-routes/{id}`: delete/deactivate an alternative route.
- `GET /v1/operator/stops`: list operator-owned stops.
- `POST /v1/operator/stops`: create an operator stop.
- `GET /v1/operator/stops/{id}`: get stop detail.
- `PATCH /v1/operator/stops/{id}`: update a stop.
- `POST /v1/operator/stations`: attach/create an operator station mapping.
- `GET /v1/operator/vehicles`: list vehicles.
- `POST /v1/operator/vehicles`: create a vehicle.
- `GET /v1/operator/vehicles/{id}`: get vehicle detail.
- `PATCH /v1/operator/vehicles/{id}`: update a vehicle.
- `GET /v1/notifications`: receive notifications for the current account. Day 39 trip incidents are sent only to active `OPERATOR_ADMIN` users of the matching operator.
- `POST /v1/notifications/{notificationId}/read`: mark an incident or other notification as read.

## Operator Staff

- Day 40 admin operations are not available to `OPERATOR_STAFF`.
- Day 39 driver operations are not available to `OPERATOR_STAFF` either. Staff can monitor the operator-facing screens already authorized by the gateway, but cannot report driver incidents or confirm arrivals on behalf of a driver.

## Driver / Assistant Boundary

The following Day 39 APIs belong to driver-facing applications and must not be called from the three web roles (`SYSTEM_ADMIN`, `OPERATOR_ADMIN`, `OPERATOR_STAFF`):

- `POST /v1/driver/trips/{tripId}/incident`
- `POST /v1/driver/trips/{tripId}/stops/{stopId}/arrive`
- `POST /v1/driver/trips/{tripId}/destination/arrive`
- `POST /v1/assistant/parcels/{parcelId}/unload`
- `POST /v1/assistant/parcels/{parcelId}/deliver`

`POST /v1/operator/trips/{tripId}/stops/{stopId}/arrive` is an obsolete path and must not be used.

## Public / Passenger-Facing

- `GET /v1/stations/search`: station autocomplete/search.
- `GET /v1/trips/search`: search trips for booking.
- `GET /v1/trips/{tripId}`: get trip detail for booking/detail page.
- `GET /v1/trips/{tripId}/seat-map`: get seat map before seat selection.
- `GET /v1/vehicle-types`: list vehicle types for operator vehicle forms.
- `POST /v1/operators/register`: public operator registration.

## Internal Service APIs

These are for backend service-to-service calls, not normal browser UI calls:

- `GET /internal/v1/stations/{id}`
- `GET /internal/v1/stops/{id}`
- `GET /internal/v1/trips/{tripId}`
- `POST /internal/v1/trips/{tripId}/lock-seats`
- `POST /internal/v1/trips/{tripId}/release-seats`
- `POST /internal/v1/trips/{tripId}/book-seats`
- `POST /internal/v1/trips/round-trip/lock-seats`

Do not call these endpoints from browser code. They require internal service credentials and are not part of the three-role frontend surface.
