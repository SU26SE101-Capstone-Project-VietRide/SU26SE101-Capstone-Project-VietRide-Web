import { Navigate, useLocation } from "react-router-dom";
import { getAuthUser, getHomePathForRole } from "../auth";

/**
 * Điểm rơi cho "/" và mọi path không khớp route nào.
 *
 * Trước đây hai chỗ này đá thẳng về /login kể cả khi người dùng đang đăng nhập.
 * Hậu quả: nếu VNPay (hoặc cấu hình VNPAY_WEB_RETURN_URL phía Backend) trả về
 * một path khác `/payments/return` — kể cả chỉ là "/" — thì người dùng vừa
 * thanh toán xong bị văng ra màn đăng nhập và mất luôn query kết quả giao dịch.
 *
 * Nên: còn query `vnp_*` thì luôn giữ nguyên và đưa về trang kết quả thanh toán;
 * hết đường thì mới về home theo role, chưa đăng nhập mới về /login.
 */
export default function EntryRedirect() {
  const location = useLocation();
  const hasVnPayResult = Array.from(
    new URLSearchParams(location.search).keys(),
  ).some((key) => key.startsWith("vnp_"));

  if (hasVnPayResult) {
    return (
      <Navigate
        to={`/payments/return${location.search}${location.hash}`}
        replace
      />
    );
  }

  const user = getAuthUser();
  if (user) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <Navigate to="/login" replace state={{ from: location }} />;
}
