// Context + type của toast system — tách khỏi ToastProvider.tsx để file component
// chỉ export component (rule react-refresh/only-export-components).
import { createContext } from "react";

export type ToastTone = "success" | "error";

export type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);
