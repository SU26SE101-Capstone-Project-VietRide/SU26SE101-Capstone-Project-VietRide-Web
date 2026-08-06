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
    const rawText = error ?? message ?? "";
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
