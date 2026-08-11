import type {
  NotificationAction,
  NotificationItem,
} from "../api/vietride";

type UnknownRecord = Record<string, unknown>;

const TRACKING_NOTIFICATION_TYPES = new Set([
  "APPROACHING_STOP",
  "CARGO_NEAR_FULL_ALERT",
  "INCIDENT_REPORTED",
  "OFF_ROUTE_ALERT",
  "TRIP_BOARDING_REMINDER",
  "TRIP_DELAYED",
  "TRIP_TRACKING",
]);

export function getNotificationActionPath(
  notification: NotificationItem,
  isAdmin: boolean,
) {
  const action = resolveNotificationAction(notification);
  switch (action.type) {
    case "OPEN_BOOKING_DETAIL":
    case "OPEN_CREW_TRIP_BOOKING":
      return withQuery("/manager/bookings", {
        bookingId: action.params.bookingId,
      });
    case "OPEN_TRIP_DETAIL":
    case "OPEN_TRIP_TRACKING":
      return withQuery("/manager/operations", {
        tripId: action.params.tripId,
      });
    case "OPEN_PARCEL_DETAIL":
      return withQuery("/manager/parcels", {
        parcelId: action.params.parcelId,
      });
    case "OPEN_WALLET":
      return isAdmin ? "/admin/wallet-settlement" : "/manager/wallet";
    case "OPEN_SUBSCRIPTION":
      return isAdmin ? "/admin/packages" : "/manager/packages";
    case "OPEN_SHUTTLE_TRACKING":
      return withQuery("/manager/dispatch", {
        shuttleTripId: action.params.shuttleTripId,
      });
    case "NONE":
      return null;
  }
}

export function resolveNotificationAction(
  notification: NotificationItem,
): NotificationAction {
  const directAction = parseNotificationAction(notification.action);
  if (directAction) return directAction;

  const data = parseUnknownRecord(notification.data);
  const nestedAction = parseNotificationAction(data?.action);
  if (nestedAction) return nestedAction;

  const actionType =
    notification.actionType ?? readString(data, "actionType");
  const actionParams = parseUnknownRecord(
    notification.actionParams ?? data?.actionParams,
  );
  const fcmAction = parseNotificationAction({
    type: actionType,
    params: actionParams ?? {},
  });
  if (fcmAction) return fcmAction;

  return inferLegacyAction(notification, data);
}

export function parseNotificationAction(
  value: unknown,
): NotificationAction | null {
  const action = parseUnknownRecord(value);
  const type = readString(action, "type");
  const params = parseUnknownRecord(action?.params) ?? {};

  switch (type) {
    case "OPEN_BOOKING_DETAIL": {
      const bookingId = readString(params, "bookingId");
      return bookingId
        ? { type, params: { bookingId } }
        : null;
    }
    case "OPEN_CREW_TRIP_BOOKING": {
      const tripId = readString(params, "tripId");
      const bookingId = readString(params, "bookingId");
      return tripId && bookingId
        ? { type, params: { tripId, bookingId } }
        : null;
    }
    case "OPEN_TRIP_DETAIL":
    case "OPEN_TRIP_TRACKING": {
      const tripId = readString(params, "tripId");
      return tripId ? { type, params: { tripId } } : null;
    }
    case "OPEN_PARCEL_DETAIL": {
      const parcelId = readString(params, "parcelId");
      return parcelId ? { type, params: { parcelId } } : null;
    }
    case "OPEN_SHUTTLE_TRACKING": {
      const shuttleTripId = readString(params, "shuttleTripId");
      return shuttleTripId
        ? { type, params: { shuttleTripId } }
        : null;
    }
    case "OPEN_WALLET":
    case "OPEN_SUBSCRIPTION":
    case "NONE":
      return { type, params: {} };
    default:
      return null;
  }
}

function inferLegacyAction(
  notification: NotificationItem,
  data: UnknownRecord | null,
): NotificationAction {
  const notificationType =
    notification.notificationType ??
    readString(data, "notificationType") ??
    notification.type;
  const normalizedType = notificationType.toUpperCase();

  if (normalizedType.includes("WALLET")) {
    return { type: "OPEN_WALLET", params: {} };
  }
  if (normalizedType.includes("SUBSCRIPTION")) {
    return { type: "OPEN_SUBSCRIPTION", params: {} };
  }

  const shuttleTripId = readString(data, "shuttleTripId");
  if (shuttleTripId) {
    return {
      type: "OPEN_SHUTTLE_TRACKING",
      params: { shuttleTripId },
    };
  }

  const parcelId = readString(data, "parcelId");
  if (parcelId) {
    return { type: "OPEN_PARCEL_DETAIL", params: { parcelId } };
  }

  const bookingId = readString(data, "bookingId");
  if (bookingId) {
    return { type: "OPEN_BOOKING_DETAIL", params: { bookingId } };
  }

  const tripId = readString(data, "tripId");
  if (tripId) {
    return {
      type:
        TRACKING_NOTIFICATION_TYPES.has(normalizedType) ||
        normalizedType.includes("TRACKING")
          ? "OPEN_TRIP_TRACKING"
          : "OPEN_TRIP_DETAIL",
      params: { tripId },
    };
  }

  return { type: "NONE", params: {} };
}

function parseUnknownRecord(value: unknown): UnknownRecord | null {
  if (typeof value === "string") {
    try {
      return parseUnknownRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readString(
  value: UnknownRecord | null | undefined,
  key: string,
): string | null {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

function withQuery(path: string, params: Record<string, string>) {
  return `${path}?${new URLSearchParams(params).toString()}`;
}
