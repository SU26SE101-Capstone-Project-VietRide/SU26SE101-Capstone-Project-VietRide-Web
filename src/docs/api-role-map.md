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

Use them from frontend only if the gateway intentionally exposes them to the current user token.
