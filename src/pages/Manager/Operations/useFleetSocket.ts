import { useEffect, useRef } from "react";
import {
  createTrackingSocket,
  joinOperatorFleet,
  type FleetGpsUpdateEvent,
} from "../../../lib/trackingSocket";

type UseFleetSocketOptions = {
  /** Điểm GPS mới từ room fleet của operator — cập nhật marker/list live */
  onFleetGpsUpdate: (event: FleetGpsUpdateEvent) => void;
  /** routeProposal:created / routeProposal:resolved — refresh badge đề xuất */
  onProposalActivity: () => void;
  /** Socket mất kết nối — poll fleet-latest mỗi 30s tới khi reconnect */
  onFallbackPoll: () => void;
  /** Reconnect sau khi từng kết nối — refresh một lần (fleet + badge) bù event đã lỡ */
  onReconnect: () => void;
};

const FALLBACK_POLL_INTERVAL_MS = 30_000;

// Socket fleet của cả màn Operations: join room operator, nghe GPS batch +
// proposal realtime (thay interval poll 60s cũ). Callback đi qua ref để effect
// chỉ chạy một lần lúc mount — không reconnect khi callback đổi identity.
export function useFleetSocket(options: UseFleetSocketOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const socket = createTrackingSocket();
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

    socket.on("connect", () => {
      if (disposed) return;
      stopFallbackPoll();
      // Ack lỗi (UNAUTHORIZED/ACCESS_DENIED) chỉ nghĩa là không có realtime —
      // màn vẫn hoạt động qua nút refresh nên bỏ qua im lặng.
      void joinOperatorFleet(socket).catch(() => {});
      if (hasConnectedOnce) optionsRef.current.onReconnect();
      hasConnectedOnce = true;
    });

    socket.on("connect_error", startFallbackPoll);
    socket.on("disconnect", startFallbackPoll);

    socket.on("fleet:gps:update", (event: FleetGpsUpdateEvent) => {
      if (!disposed) optionsRef.current.onFleetGpsUpdate(event);
    });

    const handleProposalActivity = () => {
      if (!disposed) optionsRef.current.onProposalActivity();
    };
    socket.on("routeProposal:created", handleProposalActivity);
    socket.on("routeProposal:resolved", handleProposalActivity);

    return () => {
      disposed = true;
      stopFallbackPoll();
      socket.disconnect();
    };
  }, []);
}
