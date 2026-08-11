import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FiMessageCircle, FiX } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { getAuthUser } from "../auth";
import RagAssistant from "../pages/RagAssistant";
import { useOperatorSubscription } from "../contexts/operatorSubscriptionContext";

const BUBBLE_SIZE = 56;
const VIEWPORT_GUTTER = 24;
const PANEL_GAP = 12;
const PANEL_GUTTER = 16;
const PANEL_MAX_WIDTH = 360;
const PANEL_MAX_HEIGHT = 520;
const POSITION_STORAGE_KEY = "vietride.assistant-bubble.position";

type BubblePosition = {
  x: number;
  y: number;
};

type DragState = BubblePosition & {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function clampPosition(position: BubblePosition): BubblePosition {
  if (typeof window === "undefined") {
    return position;
  }

  return {
    x: Math.min(
      Math.max(position.x, VIEWPORT_GUTTER),
      Math.max(
        VIEWPORT_GUTTER,
        window.innerWidth - BUBBLE_SIZE - VIEWPORT_GUTTER,
      ),
    ),
    y: Math.min(
      Math.max(position.y, VIEWPORT_GUTTER),
      Math.max(
        VIEWPORT_GUTTER,
        window.innerHeight - BUBBLE_SIZE - VIEWPORT_GUTTER,
      ),
    ),
  };
}

function getDefaultPosition(): BubblePosition {
  if (typeof window === "undefined") {
    return { x: VIEWPORT_GUTTER, y: VIEWPORT_GUTTER };
  }

  return clampPosition({
    x: window.innerWidth - BUBBLE_SIZE - VIEWPORT_GUTTER,
    y: window.innerHeight - BUBBLE_SIZE - VIEWPORT_GUTTER,
  });
}

function getSavedPosition(): BubblePosition {
  const fallback = getDefaultPosition();

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(POSITION_STORAGE_KEY) ?? "null",
    ) as Partial<BubblePosition> | null;

    if (typeof saved?.x === "number" && typeof saved.y === "number") {
      return clampPosition({ x: saved.x, y: saved.y });
    }
  } catch {
    // Ignore invalid or unavailable local storage and use the default position.
  }

  return fallback;
}

export default function AssistantBubble() {
  const location = useLocation();
  const user = getAuthUser();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(getSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const { hasModule } = useOperatorSubscription();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        POSITION_STORAGE_KEY,
        JSON.stringify(position),
      );
    } catch {
      // Persisting the bubble position is an enhancement, not a requirement.
    }
  }, [position]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampPosition(current));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) {
        return;
      }

      drag.moved = true;
      suppressClickRef.current = true;
      setPosition(
        clampPosition({
          x: drag.x + deltaX,
          y: drag.y + deltaY,
        }),
      );
      event.preventDefault();
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isDragging]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      ...position,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setIsDragging(true);
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setOpen((current) => !current);
  }

  function getPanelPosition() {
    if (typeof window === "undefined") {
      return { left: 0, top: 0, height: PANEL_MAX_HEIGHT };
    }

    const panelWidth = Math.min(
      PANEL_MAX_WIDTH,
      Math.max(0, window.innerWidth - PANEL_GUTTER * 2),
    );
    const spaceAbove = Math.max(
      0,
      position.y - PANEL_GAP - PANEL_GUTTER,
    );
    const spaceBelow = Math.max(
      0,
      window.innerHeight -
        (position.y + BUBBLE_SIZE + PANEL_GAP + PANEL_GUTTER),
    );
    const opensAbove = spaceAbove >= spaceBelow;
    const availableHeight = opensAbove ? spaceAbove : spaceBelow;
    const panelHeight = Math.min(PANEL_MAX_HEIGHT, availableHeight);
    const maxLeft = Math.max(
      PANEL_GUTTER,
      window.innerWidth - panelWidth - PANEL_GUTTER,
    );
    const left = Math.min(
      Math.max(position.x + BUBBLE_SIZE - panelWidth, PANEL_GUTTER),
      maxLeft,
    );

    return {
      left,
      height: panelHeight,
      top: opensAbove
        ? position.y - panelHeight - PANEL_GAP
        : position.y + BUBBLE_SIZE + PANEL_GAP,
    };
  }

  if (
    !user ||
    (user.role !== "SYSTEM_ADMIN" && user.role !== "OPERATOR_ADMIN") ||
    (user.role === "OPERATOR_ADMIN" && !hasModule("enableRag")) ||
    location.pathname.endsWith("/assistant")
  ) {
    return null;
  }

  return (
    <div
      className="fixed z-50 h-14 w-14"
      style={{ left: position.x, top: position.y }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Trợ lý nghiệp vụ"
          className="fixed w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/15"
          style={getPanelPosition()}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  Trợ lý nghiệp vụ
                </p>
                <p className="truncate text-xs text-gray-500">
                  Hỏi đáp theo chính sách VietRide
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Đóng trợ lý nghiệp vụ"
                title="Đóng"
              >
                <FiX size={19} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RagAssistant embedded />
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        className={`flex h-14 w-14 touch-none items-center justify-center rounded-full bg-vr-500 text-white shadow-lg shadow-vr-900/20 transition hover:scale-105 hover:bg-vr-600 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        aria-label={open ? "Đóng trợ lý nghiệp vụ" : "Mở trợ lý nghiệp vụ"}
        aria-expanded={open}
        title="Kéo để di chuyển trợ lý"
      >
        {open ? <FiX size={22} /> : <FiMessageCircle size={23} />}
      </button>
    </div>
  );
}
