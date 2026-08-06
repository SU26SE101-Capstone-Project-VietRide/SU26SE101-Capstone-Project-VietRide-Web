import { useContext } from "react";
import { ToastContext, type ToastApi } from "./toastContext";

// Hook bắn toast: { success(msg), error(msg) } — API trả về là object ổn định
// (memo hoá trong ToastProvider) nên đưa vào dependency array an toàn.
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return api;
}
