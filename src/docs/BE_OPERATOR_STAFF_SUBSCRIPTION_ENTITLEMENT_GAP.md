# BE handoff: expose subscription module entitlements to OPERATOR_STAFF

## Context

Manager Web now reads **GET /v1/operator/subscription** to hide operator modules
that are not included in the current plan:

- enableParcel
- enableShuttle
- enableRag

This prevents the UI from mounting pages that Backend will reject with
SUBSCRIPTION_MODULE_DISABLED.

## Current Backend boundary

Gateway route **/v1/operator/subscription** and
OperatorSubscriptionController only allow OPERATOR_ADMIN.
OPERATOR_STAFF therefore cannot read the module flags for its own operator.

The FE intentionally keeps the existing staff Parcel/Shuttle navigation visible
instead of failing closed, because hiding by default would also hide modules
that the operator has already purchased.

## Requested additive change

Allow OPERATOR_STAFF to call a read-only entitlement endpoint scoped only by
the verified operatorId in JWT. Either:

1. extend GET /v1/operator/subscription GET permission to
   OPERATOR_ADMIN and OPERATOR_STAFF while keeping upgrade/payment mutations
   admin-only; or
2. add GET /v1/operator/subscription/entitlements returning only:

    {
      "status": "ACTIVE",
      "modules": {
        "enableParcel": true,
        "enableShuttle": false,
        "enableRag": true
      }
    }

Do not accept operatorId from query/path. Resolve tenant scope from the
verified JWT.

## Acceptance criteria

- Staff from operator A cannot read operator B entitlements.
- GET is available to OPERATOR_ADMIN and OPERATOR_STAFF.
- Upgrade, retry-payment, billing and invoice mutations remain admin-only.
- Response reflects the active/current entitled plan during
  ACTIVE and PENDING_PAYMENT.
- Add Gateway RBAC and Identity controller integration tests.
