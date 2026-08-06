import { useState } from "react";
import { FiMessageCircle, FiX } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { getAuthUser } from "../auth";
import RagAssistant from "../pages/RagAssistant";

export default function AssistantBubble() {
  const location = useLocation();
  const user = getAuthUser();
  const [open, setOpen] = useState(false);

  if (
    !user ||
    (user.role !== "SYSTEM_ADMIN" && user.role !== "OPERATOR_ADMIN") ||
    location.pathname.endsWith("/assistant")
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 h-[min(600px,calc(100vh-5rem))] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/15">
          <RagAssistant embedded />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-vr-500 text-white shadow-lg shadow-vr-900/20 transition hover:scale-105 hover:bg-vr-600"
        aria-label={open ? "Đóng trợ lý nghiệp vụ" : "Mở trợ lý nghiệp vụ"}
        aria-expanded={open}
      >
        {open ? <FiX size={22} /> : <FiMessageCircle size={23} />}
      </button>
    </div>
  );
}
