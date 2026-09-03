import { io, type Socket } from "socket.io-client";
import { getAuthSession } from "../auth";
import type { NotificationItem } from "../api/vietride";
import { parseNotificationAction } from "../utils/notificationActions";
import { isRecord } from "../utils/typeGuards";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
/**
 * Nginx route `/notification/socket.io/` thẳng tới Notification service nên
 * socket dùng đúng public origin của REST, namespace mặc định `/` và không có
 * tiền tố `/v1`. `VITE_NOTIFICATION_SOCKET_URL` chỉ để chạy local khi chưa có
 * Nginx — Gateway không proxy route WebSocket này, đừng trỏ vào cổng Gateway.
 */
const NOTIFICATION_SOCKET_URL =
  import.meta.env.VITE_NOTIFICATION_SOCKET_URL || API_BASE_URL;
const NOTIFICATION_SOCKET_PATH = "/notification/socket.io";

export const NOTIFICATION_CREATED_EVENT = "notification:created";

/**
 * Server tự join room `notification:user:{sub}` từ JWT đã xác minh nên client
 * không emit event join nào. Không có access token thì khỏi mở socket: BE trả
 * `connect_error` UNAUTHORIZED và socket.io sẽ retry vô hạn vô ích.
 */
export function createNotificationSocket(): Socket | null {
  const accessToken = getAuthSession()?.accessToken;
  if (!accessToken) return null;

  return io(NOTIFICATION_SOCKET_URL || undefined, {
    path: NOTIFICATION_SOCKET_PATH,
    auth: { token: accessToken },
    transports: ["websocket"],
  });
}

/**
 * Payload `notification:created` là DTO thô: không bọc envelope `ApiResponse`,
 * không có `userId` và không có `deepLink`. Chỉ nhận event có `id` vì inbox
 * dedupe theo `id` (Socket.IO là at-least-once, event có thể được replay).
 *
 * @returns null nếu payload không dùng được — caller nên lùi về REST inbox.
 */
export function parseNotificationCreatedEvent(
  payload: unknown,
): NotificationItem | null {
  if (!isRecord(payload)) return null;

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;

  const action = parseNotificationAction(payload.action);
  const rawAction = isRecord(payload.action) ? payload.action : null;
  const unsupportedActionType =
    action == null && typeof rawAction?.type === "string"
      ? rawAction.type.trim()
      : "";

  return {
    id,
    type: typeof payload.type === "string" ? payload.type : "",
    title: typeof payload.title === "string" ? payload.title : "",
    body: typeof payload.body === "string" ? payload.body : "",
    data: payload.data ?? null,
    action,
    // Giữ lại dấu vết action không hợp lệ/không được hỗ trợ để resolver
    // không rơi xuống nhánh suy luận legacy theo notification type.
    ...(unsupportedActionType ? { actionType: unsupportedActionType } : {}),
    readAt: typeof payload.readAt === "string" ? payload.readAt : null,
    createdAt:
      typeof payload.createdAt === "string"
        ? payload.createdAt
        : new Date().toISOString(),
  };
}
