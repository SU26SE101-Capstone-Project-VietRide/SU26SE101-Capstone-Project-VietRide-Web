import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiGitBranch,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import type { TripStatusChangedEvent } from "../../../lib/trackingSocket";
import type { RealtimeStatus } from "./gpsHelpers";

type OperationsStatusBarProps = {
  /** Trạng thái socket của cả màn, không phụ thuộc có chọn chuyến hay không */
  connectionStatus: RealtimeStatus;
  /** Khoảng thời gian poll dự phòng khi mất realtime, hiển thị cho người dùng */
  fallbackPollSeconds: number;
  disruptedCount: number;
  lostSignalCount: number;
  /** Sự kiện trễ giờ của chuyến đang mở; null = không trễ */
  delayInfo: TripStatusChangedEvent | null;
  delayedTripLabel: string | null;
  pendingProposalCount: number;
  /** Chỉ OPERATOR_ADMIN mới duyệt được đề xuất lộ trình */
  canReviewProposals: boolean;
  onShowDisrupted: () => void;
  /** Mở danh sách sự cố do tài xế báo (khác trạng thái DISRUPTED của chuyến) */
  onOpenIncidents: () => void;
  onShowLostSignal: () => void;
  onOpenProposals: () => void;
};

type ChipTone = "danger" | "warning" | "info" | "neutral";

const chipToneClass: Record<ChipTone, string> = {
  danger:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 focus-visible:outline-red-500",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:outline-amber-500",
  info: "border-vr-200 bg-vr-50 text-vr-800 hover:bg-vr-100 focus-visible:outline-vr-500",
  neutral:
    "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-gray-400",
};

function StatusChip({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone: ChipTone;
  onClick?: () => void;
}) {
  const className = `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${chipToneClass[tone]}`;

  if (!onClick) {
    return (
      <span className={className}>
        {icon}
        {label}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${className} cursor-pointer`}>
      {icon}
      {label}
    </button>
  );
}

/**
 * Dải trạng thái luôn hiển thị ngay dưới tiêu đề màn Trung tâm vận hành.
 *
 * Trước đây mọi tín hiệu sự cố đều nằm rải rác và chỉ thấy được khi đã chọn
 * đúng chuyến: mất kết nối realtime chỉ hiện dưới dạng một chấm nhỏ trong panel
 * bên phải, chuyến trễ giờ nằm sâu trong panel đó, còn đề xuất đổi lộ trình của
 * tài xế chỉ có một badge nhỏ đè lên góc bản đồ. Gom hết vào một dải duy nhất
 * để điều độ viên nhìn một chỗ là biết đội xe có vấn đề gì và bấm thẳng vào đó.
 */
export default function OperationsStatusBar({
  connectionStatus,
  fallbackPollSeconds,
  disruptedCount,
  lostSignalCount,
  delayInfo,
  delayedTripLabel,
  pendingProposalCount,
  canReviewProposals,
  onShowDisrupted,
  onOpenIncidents,
  onShowLostSignal,
  onOpenProposals,
}: OperationsStatusBarProps) {
  const { t } = useTranslation("manager");

  const offline = connectionStatus === "error";
  const connecting = connectionStatus === "connecting";
  const showProposals = canReviewProposals && pendingProposalCount > 0;
  const allClear =
    !offline &&
    !connecting &&
    disruptedCount === 0 &&
    lostSignalCount === 0 &&
    !delayInfo &&
    !showProposals;

  // Mất realtime là vấn đề của toàn màn chứ không của riêng một chuyến: đổi màu
  // cả dải và nói thẳng dữ liệu đang được làm mới bằng cách nào.
  const barToneClass = offline
    ? "border-amber-300 bg-amber-50"
    : disruptedCount > 0
      ? "border-red-200 bg-red-50/60"
      : "border-gray-200 bg-white";

  return (
    <section
      aria-label={t("operations.statusBarAria")}
      className={`rounded-xl border p-3 shadow-sm transition-colors sm:px-4 ${barToneClass}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {offline ? (
          <StatusChip
            tone="warning"
            icon={<FiWifiOff size={14} aria-hidden="true" />}
            label={t("operations.realtimeOffline", {
              seconds: fallbackPollSeconds,
            })}
          />
        ) : connecting ? (
          <StatusChip
            tone="neutral"
            icon={<FiWifi size={14} aria-hidden="true" />}
            label={t("gps.realtimeConnecting")}
          />
        ) : (
          <StatusChip
            tone="neutral"
            icon={<FiWifi size={14} className="text-emerald-600" aria-hidden="true" />}
            label={t("operations.realtimeLive")}
          />
        )}

        {disruptedCount > 0 && (
          <StatusChip
            tone="danger"
            icon={<FiAlertTriangle size={14} aria-hidden="true" />}
            label={t("operations.disruptedChip", { count: disruptedCount })}
            onClick={onShowDisrupted}
          />
        )}

        {lostSignalCount > 0 && (
          <StatusChip
            tone="warning"
            icon={<FiWifiOff size={14} aria-hidden="true" />}
            label={t("operations.lostSignalChip", { count: lostSignalCount })}
            onClick={onShowLostSignal}
          />
        )}

        {delayInfo && (
          <StatusChip
            tone="warning"
            icon={<FiClock size={14} aria-hidden="true" />}
            label={t("operations.delayChip", {
              minutes: delayInfo.delayMinutes,
              trip: delayedTripLabel ?? "",
            })}
          />
        )}

        {/* Sự cố tài xế báo là luồng riêng, không suy ra từ trạng thái chuyến */}
        <StatusChip
          tone="neutral"
          icon={<FiAlertTriangle size={14} aria-hidden="true" />}
          label={t("operations.incidentsChip")}
          onClick={onOpenIncidents}
        />

        {showProposals && (
          <StatusChip
            tone="info"
            icon={<FiGitBranch size={14} aria-hidden="true" />}
            label={t("operations.proposalChip", { count: pendingProposalCount })}
            onClick={onOpenProposals}
          />
        )}

        {allClear && (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
            <FiCheckCircle size={14} className="text-emerald-500" aria-hidden="true" />
            {t("operations.allClear")}
          </span>
        )}
      </div>

      {offline && (
        <p className="mt-2 text-xs text-amber-900">
          {t("operations.realtimeOfflineHint")}
        </p>
      )}
    </section>
  );
}
