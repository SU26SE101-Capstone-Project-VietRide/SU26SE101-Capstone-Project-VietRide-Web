import { useContext, useEffect, useRef } from "react";
import { ToastContext } from "../components/toast/toastContext";

type ToastFeedback = {
  message?: string | null;
  error?: string | null;
};

export function useToastFeedback({ message, error }: ToastFeedback) {
  const toast = useContext(ToastContext);
  const lastToastRef = useRef("");

  useEffect(() => {
    if (!toast || (!message && !error)) {
      lastToastRef.current = "";
      return;
    }

    const tone = error ? "error" : "success";
    // Dùng || chứ không phải ?? — error thường là useState("") (chuỗi rỗng,
    // không phải null/undefined) khi không có lỗi. ?? không rơi qua chuỗi
    // rỗng nên trước đây rawText bị khoá cứng vào error="" và bỏ qua hẳn
    // message thật, khiến toast luôn hiện fallback chung "Thao tác đã hoàn
    // tất." thay vì nội dung thành công thực sự (vd sau khi sửa xe/ghế).
    const rawText = error || message || "";
    const text = rawText.trim()
      ? rawText
      : error
        ? "Đã xảy ra lỗi, vui lòng thử lại."
        : "Thao tác đã hoàn tất.";
    const key = `${tone}:${text}`;
    if (lastToastRef.current === key) return;

    lastToastRef.current = key;
    if (error) {
      toast.error(error);
    } else {
      toast.success(text);
    }
  }, [error, message, toast]);
}
