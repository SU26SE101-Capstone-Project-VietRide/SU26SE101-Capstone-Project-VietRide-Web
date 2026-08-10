import type { Socket } from "socket.io-client";
import { refreshAuthSession } from "../auth";

/**
 * Access token sống 15 phút, còn socket chỉ đọc token đúng một lần lúc tạo
 * (`auth: { token }`). Nếu mất kết nối lâu hơn TTL, mọi lượt reconnect của
 * socket.io đều mang token đã hết hạn, nhận `connect_error` UNAUTHORIZED và
 * retry vô hạn mà không bao giờ vào lại được — realtime chết im lặng.
 *
 * Refresh đúng một lần cho mỗi chu kỳ hỏng: cờ chỉ mở lại sau khi `connect`
 * thành công, nên UNAUTHORIZED vì lý do khác (token bị revoke, sai khoá ký)
 * không biến thành vòng lặp gọi /auth/refresh.
 *
 * @returns hàm gỡ listener. Gọi trong cleanup của effect **trước**
 *   `socket.disconnect()` để một promise refresh về muộn không hồi sinh socket
 *   vừa bị dọn.
 */
export function attachSocketAuthRecovery(socket: Socket): () => void {
  let recovering = false;
  let disposed = false;

  const handleConnect = () => {
    recovering = false;
  };

  const handleConnectError = (error: Error) => {
    if (disposed || recovering || error.message !== "UNAUTHORIZED") return;
    recovering = true;

    void refreshAuthSession().then((session) => {
      // Không có session mới = refresh token cũng hỏng, người dùng phải đăng
      // nhập lại. Giữ nguyên cờ recovering để khỏi gọi refresh thêm lần nào.
      if (disposed || !session?.accessToken) return;
      socket.auth = { token: session.accessToken };
      socket.connect();
    });
  };

  socket.on("connect", handleConnect);
  socket.on("connect_error", handleConnectError);

  return () => {
    disposed = true;
    socket.off("connect", handleConnect);
    socket.off("connect_error", handleConnectError);
  };
}
