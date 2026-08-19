import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type InfoHintProps = {
  /** Nội dung giải thích hiện ra khi bấm dấu chấm than. */
  text: string;
  /** Nhãn cho screen reader, vd "Đây là gì?". */
  label: string;
};

const TOOLTIP_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

// Dấu "!" nhỏ đứng cạnh nhãn viết tắt: hover thấy tooltip gốc của trình duyệt,
// bấm thì mở popover cho thiết bị cảm ứng (hover không tồn tại trên mobile).
export default function InfoHint({ text, label }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const descriptionId = useId();

  // Tooltip render bằng position:fixed vì nó hay nằm trong modal/bảng có
  // overflow — bám theo dòng chữ thì bị cắt mất một phần (và đè lên chữ ở trên).
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }

    const anchor = buttonRef.current.getBoundingClientRect();
    const height = tooltipRef.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(
        anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2,
        VIEWPORT_MARGIN,
      ),
      window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
    );
    // Ưu tiên đặt bên dưới; không đủ chỗ mới lật lên trên.
    const below = anchor.bottom + 6;
    const flipUp = below + height > window.innerHeight - VIEWPORT_MARGIN;

    setPosition({ top: flipUp ? anchor.top - height - 6 : below, left });
  }, [open, text]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!buttonRef.current?.parentElement?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    // Cuộn/resize thì toạ độ fixed hết đúng — đóng luôn cho gọn.
    const close = () => setOpen(false);

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? descriptionId : undefined}
        title={text}
        className="info-hint-button inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-semibold leading-none text-gray-500 transition hover:border-vr-300 hover:bg-vr-50 hover:text-vr-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-vr-500/40"
      >
        !
      </button>
      {open && (
        <span
          ref={tooltipRef}
          id={descriptionId}
          role="tooltip"
          style={{
            top: position.top,
            left: position.left,
            width: TOOLTIP_WIDTH,
          }}
          className="fixed z-50 whitespace-normal rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium leading-relaxed text-gray-700 shadow-lg shadow-gray-900/10"
        >
          {text}
        </span>
      )}
    </span>
  );
}
