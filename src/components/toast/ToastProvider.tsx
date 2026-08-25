// Toast system dùng chung: nổi góc phải-trên (dưới topbar). Cả hai loại đều tự
// tắt — thành công 3s, lỗi 6s vì cần thời gian đọc.
// Không thêm dependency — render qua createPortal vào body, animation bằng Tailwind.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";
import { ToastContext, type ToastApi, type ToastTone } from "./toastContext";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

// Hover thì tạm dừng đếm giờ (rời chuột đếm lại từ đầu) — đủ để người dùng giữ
// chuột lại mà đọc nốt thông báo dài.
const TOAST_DURATION_MS = 3000;
// Lỗi ở lại lâu gấp đôi: 3s không đủ đọc xong một thông báo lỗi, mà khi nó tắt
// thì màn hình chỉ còn dữ liệu cũ, không còn dấu vết nào cho biết thao tác vừa
// rồi đã hỏng. Vẫn tự tắt để không đọng toast lỗi cũ trên màn hình; đọc chưa
// kịp thì rê chuột vào là dừng đếm.
const TOAST_ERROR_DURATION_MS = 6000;
// Tối đa 5 toast cùng lúc — cái cũ nhất bị đẩy ra khỏi stack.
const MAX_TOASTS = 5;

type ToastProviderProps = {
  children: ReactNode;
};

export default function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  // Timer auto-dismiss theo từng toast id — để pause/resume khi hover.
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const startTimer = useCallback(
    (id: number, tone: ToastTone) => {
      const existing = timersRef.current.get(id);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      timersRef.current.set(
        id,
        setTimeout(
          () => dismiss(id),
          tone === "error" ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS,
        ),
      );
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const content = message.trim()
        ? message
        : tone === "error"
          ? "Đã xảy ra lỗi, vui lòng thử lại."
          : "Thao tác đã hoàn tất.";

      nextIdRef.current += 1;
      const id = nextIdRef.current;
      // Vượt MAX_TOASTS thì cắt cái cũ nhất; timer mồ côi của nó tự nổ
      // thành no-op trong dismiss nên không cần dọn tay ở đây.
      setToasts((current) =>
        [...current, { id, tone, message: content }].slice(-MAX_TOASTS),
      );
      startTimer(id, tone);
    },
    [startTimer],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    [push],
  );

  // Dọn toàn bộ timer khi provider unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div
            data-testid="toast-stack"
            className="pointer-events-none fixed top-24 right-4 z-[9999] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
          >
            {toasts.map((toast) => (
              <ToastCard
                key={toast.id}
                toast={toast}
                onClose={() => dismiss(toast.id)}
                onPause={() => pauseTimer(toast.id)}
                onResume={() => startTimer(toast.id, toast.tone)}
              />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

type ToastCardProps = {
  toast: ToastItem;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
};

// Sub-component ≤ 50 dòng, chỉ file này dùng — inline theo CODE_CONVENTIONS §2.
function ToastCard({ toast, onClose, onPause, onResume }: ToastCardProps) {
  const { t } = useTranslation("common");
  // Mount ở trạng thái dịch phải + trong suốt, frame sau trượt vào (slide-in).
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const isSuccess = toast.tone === "success";
  const Icon = isSuccess ? FiCheckCircle : FiAlertCircle;

  return (
    <div
      data-testid="toast"
      role={isSuccess ? "status" : "alert"}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-lg transition duration-300 ease-out ${
        isSuccess ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500"
      } ${entered ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <Icon
        className={`mt-0.5 shrink-0 ${isSuccess ? "text-emerald-500" : "text-rose-500"}`}
        size={18}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 break-words">{toast.message}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <FiX size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
