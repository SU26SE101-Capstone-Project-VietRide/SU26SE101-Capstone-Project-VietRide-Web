import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  createTrackingSocket,
  joinShuttleTracking,
  type ShuttleEtaUpdateEvent,
  type ShuttleGpsUpdateEvent,
} from "../../../lib/trackingSocket";
import { attachSocketAuthRecovery } from "../../../lib/socketAuthRecovery";
import type { ShuttleRealtimeStatus } from "./dispatchHelpers";

type UseShuttleTrackingSocketOptions = {
  /** Các chuyến trung chuyển đang hoạt động cần theo dõi (SCHEDULED/IN_PROGRESS) */
  shuttleTripIds: string[];
  /** GPS mới từ room `shuttle:{id}` */
  onGps: (event: ShuttleGpsUpdateEvent) => void;
  /** ETA điểm đón kế tiếp, BE chỉ tính lại tối đa mỗi 60s */
  onEta: (event: ShuttleEtaUpdateEvent) => void;
  /**
   * Join room thành công. Room chỉ phát khi tài xế gửi GPS tiếp theo, nên màn
   * cần nạp một lần `latest`/`eta` từ REST để có dữ liệu ngay thay vì chờ.
   */
  onJoined: (shuttleTripId: string) => void;
  /** Trạng thái kết nối hiển thị ở đầu mục theo dõi */
  onStatus: (status: ShuttleRealtimeStatus) => void;
};

/**
 * Một socket duy nhất cho cả mục theo dõi trung chuyển: join room của mọi
 * chuyến đang hoạt động rồi nghe `shuttle:gps:update` / `shuttle:eta:update`.
 *
 * BE (`location.gateway.ts`) chỉ có handler join, không có message rời room —
 * chuyến đã kết thúc vẫn tiếp tục phát về trên kết nối hiện tại. Hai handler
 * event vì thế phải tự lọc theo danh sách chuyến đang theo dõi.
 *
 * Ack join thất bại (`ACCESS_DENIED`, `SHUTTLE_TRIP_NOT_FOUND`) chỉ nghĩa là
 * chuyến đó không có realtime; nút làm mới thủ công trên từng thẻ vẫn chạy nên
 * bỏ qua im lặng thay vì báo lỗi cả mục.
 */
export function useShuttleTrackingSocket(
  options: UseShuttleTrackingSocketOptions,
) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const socketRef = useRef<Socket | null>(null);
  // Room là trạng thái phía server: mất kết nối là mất sạch, nên xoá ở
  // disconnect để lượt connect sau join lại từ đầu.
  const joinedIdsRef = useRef(new Set<string>());

  const joinMissingRooms = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    for (const shuttleTripId of optionsRef.current.shuttleTripIds) {
      if (joinedIdsRef.current.has(shuttleTripId)) continue;
      // Đánh dấu trước khi chờ ack: danh sách chuyến được tải lại định kỳ, nếu
      // đợi ack mới ghi nhận thì mỗi lượt tải lại sẽ emit join trùng.
      joinedIdsRef.current.add(shuttleTripId);

      void joinShuttleTracking(socket, shuttleTripId)
        .then((ack) => {
          if (socketRef.current !== socket) return;
          if (!ack.success) {
            joinedIdsRef.current.delete(shuttleTripId);
            return;
          }
          optionsRef.current.onJoined(shuttleTripId);
        })
        .catch(() => {
          // emitWithAck đặt timeout 5s: quá hạn thì reject, phải bắt để không
          // rơi thành unhandled rejection.
          if (socketRef.current === socket) {
            joinedIdsRef.current.delete(shuttleTripId);
          }
        });
    }
  }, []);

  useEffect(() => {
    const socket = createTrackingSocket();
    socketRef.current = socket;
    const disposeAuthRecovery = attachSocketAuthRecovery(socket);
    let disposed = false;

    optionsRef.current.onStatus("connecting");

    socket.on("connect", () => {
      if (disposed) return;
      joinedIdsRef.current.clear();
      optionsRef.current.onStatus("connected");
      joinMissingRooms();
    });

    const markDisconnected = () => {
      if (disposed) return;
      joinedIdsRef.current.clear();
      optionsRef.current.onStatus("error");
    };
    socket.on("connect_error", markDisconnected);
    socket.on("disconnect", markDisconnected);

    socket.on("shuttle:gps:update", (event: ShuttleGpsUpdateEvent) => {
      if (disposed) return;
      if (!optionsRef.current.shuttleTripIds.includes(event.shuttleTripId)) return;
      optionsRef.current.onGps(event);
    });

    socket.on("shuttle:eta:update", (event: ShuttleEtaUpdateEvent) => {
      if (disposed) return;
      if (!optionsRef.current.shuttleTripIds.includes(event.shuttleTripId)) return;
      optionsRef.current.onEta(event);
    });

    return () => {
      disposed = true;
      disposeAuthRecovery();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joinMissingRooms]);

  // Chuyến mới tạo xong sẽ xuất hiện ở lượt tải danh sách kế tiếp — join thêm
  // room cho nó mà không dựng lại socket.
  const joinKey = options.shuttleTripIds.join(",");
  useEffect(() => {
    joinMissingRooms();
  }, [joinMissingRooms, joinKey]);
}
