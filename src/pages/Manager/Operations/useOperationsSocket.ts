import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  createTrackingSocket,
  joinOperatorFleet,
  joinTripTracking,
  type FleetGpsUpdateEvent,
  type TrackingEtaBatchUpdateEvent,
  type TrackingEtaUpdateEvent,
  type TrackingLatestLocation,
  type TripStatusChangedEvent,
} from "../../../lib/trackingSocket";
import { attachSocketAuthRecovery } from "../../../lib/socketAuthRecovery";
import type { RealtimeStatus } from "./gpsHelpers";

type UseOperationsSocketOptions = {
  /** Chuyến đang mở ở panel theo dõi; null = chỉ nghe luồng fleet */
  tripId: string | null;
  /** Điểm GPS mới từ room fleet của operator — cập nhật marker/list live */
  onFleetGpsUpdate: (event: FleetGpsUpdateEvent) => void;
  /** routeProposal:created / routeProposal:resolved — refresh badge đề xuất */
  onProposalActivity: () => void;
  /** Socket mất kết nối — poll fleet-latest mỗi 30s tới khi reconnect */
  onFallbackPoll: () => void;
  /** Reconnect sau khi từng kết nối — refresh một lần (fleet + badge) bù event đã lỡ */
  onReconnect: () => void;
  /** GPS của riêng chuyến đang theo dõi */
  onTripGps: (event: TrackingLatestLocation) => void;
  onTripEta: (event: TrackingEtaUpdateEvent) => void;
  onTripEtaBatch: (event: TrackingEtaBatchUpdateEvent) => void;
  onTripStatusChanged: (event: TripStatusChangedEvent) => void;
  /** Trạng thái hiển thị cạnh panel theo dõi */
  onTripRealtimeStatus: (status: RealtimeStatus) => void;
  /** Join room chuyến bị BE từ chối hoặc ack quá hạn — màn hiện lỗi riêng */
  onTripJoinFailed: () => void;
  /**
   * Trạng thái kết nối của cả màn, độc lập với việc có chọn chuyến hay không.
   * Cần tách khỏi `onTripRealtimeStatus` vì mất realtime ảnh hưởng luôn cả
   * luồng fleet — điều độ viên phải biết kể cả khi chưa mở chuyến nào.
   */
  onConnectionStatus: (status: RealtimeStatus) => void;
};

export const FALLBACK_POLL_INTERVAL_MS = 30_000;

/**
 * Một socket duy nhất cho cả màn Operations: room fleet của operator (GPS batch
 * + đề xuất lộ trình) và room của chuyến đang mở ở panel phải.
 *
 * Trước đây màn mở hai kết nối riêng, trong đó kết nối theo chuyến bị huỷ và
 * dựng lại mỗi lần người dùng đổi chuyến. Nay socket sống suốt vòng đời màn,
 * đổi chuyến chỉ phát thêm một lệnh join.
 *
 * Đánh đổi: BE chưa có message rời room (`location.gateway.ts` chỉ có các
 * handler join), nên room của chuyến đã xem vẫn tiếp tục phát về. Mọi handler
 * theo chuyến vì thế phải đối chiếu `tripId` với chuyến đang mở.
 */
export function useOperationsSocket(options: UseOperationsSocketOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const socketRef = useRef<Socket | null>(null);
  // Room đã join trên kết nối hiện tại. Room là trạng thái phía server nên mất
  // kết nối là mất sạch — xoá ở disconnect để lượt connect sau join lại.
  const joinedTripIdsRef = useRef(new Set<string>());

  const joinTrip = useCallback((tripId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (joinedTripIdsRef.current.has(tripId)) {
      optionsRef.current.onTripRealtimeStatus("connected");
      return;
    }

    void joinTripTracking(socket, tripId)
      .then((ack) => {
        // Người dùng có thể đã đổi chuyến trong lúc chờ ack
        if (optionsRef.current.tripId !== tripId) return;
        if (ack.success) {
          joinedTripIdsRef.current.add(tripId);
          optionsRef.current.onTripRealtimeStatus("connected");
          return;
        }
        optionsRef.current.onTripRealtimeStatus("error");
        optionsRef.current.onTripJoinFailed();
      })
      .catch(() => {
        // emitWithAck đặt timeout 5s: quá hạn thì reject, không được để rơi
        // thành unhandled rejection như bản cũ.
        if (optionsRef.current.tripId !== tripId) return;
        optionsRef.current.onTripRealtimeStatus("error");
        optionsRef.current.onTripJoinFailed();
      });
  }, []);

  useEffect(() => {
    const socket = createTrackingSocket();
    socketRef.current = socket;
    const disposeAuthRecovery = attachSocketAuthRecovery(socket);
    let pollId: number | null = null;
    let hasConnectedOnce = false;
    let disposed = false;

    const startFallbackPoll = () => {
      if (disposed || pollId != null) return;
      pollId = window.setInterval(
        () => optionsRef.current.onFallbackPoll(),
        FALLBACK_POLL_INTERVAL_MS,
      );
    };

    const stopFallbackPoll = () => {
      if (pollId == null) return;
      window.clearInterval(pollId);
      pollId = null;
    };

    const markDisconnected = () => {
      joinedTripIdsRef.current.clear();
      optionsRef.current.onConnectionStatus("error");
      if (optionsRef.current.tripId) {
        optionsRef.current.onTripRealtimeStatus("error");
      }
    };

    optionsRef.current.onConnectionStatus("connecting");

    socket.on("connect", () => {
      if (disposed) return;
      stopFallbackPoll();
      joinedTripIdsRef.current.clear();
      optionsRef.current.onConnectionStatus("connected");
      // Ack lỗi (UNAUTHORIZED/ACCESS_DENIED) chỉ nghĩa là không có realtime —
      // màn vẫn hoạt động qua nút refresh nên bỏ qua im lặng.
      void joinOperatorFleet(socket).catch(() => {});
      const { tripId } = optionsRef.current;
      if (tripId) joinTrip(tripId);
      if (hasConnectedOnce) optionsRef.current.onReconnect();
      hasConnectedOnce = true;
    });

    socket.on("connect_error", () => {
      if (disposed) return;
      startFallbackPoll();
      markDisconnected();
    });

    socket.on("disconnect", () => {
      if (disposed) return;
      startFallbackPoll();
      markDisconnected();
    });

    socket.on("fleet:gps:update", (event: FleetGpsUpdateEvent) => {
      if (!disposed) optionsRef.current.onFleetGpsUpdate(event);
    });

    const handleProposalActivity = () => {
      if (!disposed) optionsRef.current.onProposalActivity();
    };
    socket.on("routeProposal:created", handleProposalActivity);
    socket.on("routeProposal:resolved", handleProposalActivity);

    // Room của chuyến đã xem chưa được rời (BE thiếu leaveTripTracking) nên bốn
    // handler dưới đây phải tự lọc theo chuyến đang mở.
    socket.on("gps:update", (event: TrackingLatestLocation) => {
      if (disposed || event.tripId !== optionsRef.current.tripId) return;
      optionsRef.current.onTripGps(event);
    });

    socket.on("eta:update", (event: TrackingEtaUpdateEvent) => {
      if (disposed || event.tripId !== optionsRef.current.tripId) return;
      optionsRef.current.onTripEta(event);
    });

    socket.on("eta:batch:update", (event: TrackingEtaBatchUpdateEvent) => {
      if (disposed || event.tripId !== optionsRef.current.tripId) return;
      optionsRef.current.onTripEtaBatch(event);
    });

    socket.on("trip:statusChanged", (event: TripStatusChangedEvent) => {
      if (disposed || event.tripId !== optionsRef.current.tripId) return;
      optionsRef.current.onTripStatusChanged(event);
    });

    return () => {
      disposed = true;
      stopFallbackPoll();
      disposeAuthRecovery();
      socket.disconnect();
      socketRef.current = null;
      // Không cần dọn joinedTripIds ở đây: handler `connect` của socket kế tiếp
      // luôn xoá trước khi join lại.
    };
  }, [joinTrip]);

  const { tripId } = options;
  useEffect(() => {
    if (!tripId) {
      optionsRef.current.onTripRealtimeStatus("idle");
      return;
    }
    // Chưa kết nối thì giữ "connecting"; handler connect/connect_error sẽ chốt
    // lại trạng thái khi socket có kết quả.
    optionsRef.current.onTripRealtimeStatus("connecting");
    joinTrip(tripId);
  }, [joinTrip, tripId]);
}
