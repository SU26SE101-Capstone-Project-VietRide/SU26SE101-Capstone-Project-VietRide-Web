// Panel nổi của tab "Tuyến thay thế" — MAP-FIRST (phụ lục spec 2026-08-07):
// form gọn (tên/mô tả/bến đến/kích hoạt) + danh sách 0-2 tuyến thay thế +
// điểm dừng (chỉ đọc, thêm/gỡ qua chấm gợi ý trên map — không còn editor nhập
// tay). Km/phút KHÔNG còn ô nhập — hiện dạng chỉ đọc, tự tính từ polyline đang
// soạn trên bản đồ (xem useAlternativeRouteWorkspace).
import { useTranslation } from "react-i18next";
import { FiGitBranch, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import SectionHeader from "./SectionHeader";
import StopSearchBox from "./StopSearchBox";
import { Input, StationSelect } from "./formControls";
import type { UseAlternativeRouteWorkspaceResult } from "./useAlternativeRouteWorkspace";
import type { OperatorStop } from "../../../api/vietride";
import type { StationOption, StopSuggestion } from "./types";

type AlternativeRoutesSectionProps = {
  canManageRoutes: boolean;
  hasSelectedRoute: boolean;
  stations: StationOption[];
  stops: OperatorStop[];
  workspace: UseAlternativeRouteWorkspaceResult;
  onPickSearchResult: (result: StopSuggestion) => void;
  isLoadingSuggestions?: boolean;
};

export default function AlternativeRoutesSection({
  canManageRoutes,
  hasSelectedRoute,
  stations,
  stops,
  workspace,
  onPickSearchResult,
  isLoadingSuggestions = false,
}: AlternativeRoutesSectionProps) {
  const { t } = useTranslation("manager");
  const {
    alternativeRoutes,
    selectedAlternativeRouteId,
    altForm,
    altMetrics,
    altStopDrafts,
    startNewAlternative,
    handleSelectAlternativeRoute,
    updateAltField,
    toggleAlternativeActive,
    removeAltStop,
    setPendingDeleteAlternative,
  } = workspace;

  if (!hasSelectedRoute) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("routes.alternativeSelectRoute")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={<FiGitBranch />}
        title={t("routes.alternativeManagement")}
        subtitle={t("routes.alternativeManagementHint")}
      />

      <div className="rounded-lg border border-vr-100 bg-vr-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">
            {t("routes.alternativeCapacity", { count: alternativeRoutes.length })}
          </p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-vr-700">
            {alternativeRoutes.length}/2
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {alternativeRoutes.map((alternative, index) => (
          <button
            key={alternative.id}
            type="button"
            onClick={() => handleSelectAlternativeRoute(alternative.id)}
            className={
              selectedAlternativeRouteId === alternative.id
                ? "rounded-lg border border-vr-300 bg-vr-50 p-3 text-left ring-1 ring-vr-200"
                : "rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-vr-200 hover:bg-gray-50"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-vr-700">
                {t("routes.alternativeNumber", { number: index + 1 })}
              </span>
              <span
                className={
                  alternative.isActive
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                    : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500"
                }
              >
                {alternative.isActive
                  ? t("routes.alternativeActive")
                  : t("routes.alternativeInactive")}
              </span>
            </div>
            <p className="mt-1 font-semibold text-gray-900">{alternative.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {alternative.totalDistanceKm} km · {alternative.estimatedDurationMinutes}{" "}
              {t("routes.minutes")}
            </p>
          </button>
        ))}
        {!alternativeRoutes.length && (
          <p className="text-sm text-gray-500">{t("routes.alternativeEmpty")}</p>
        )}
      </div>

      {canManageRoutes && (
        <>
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <Input
              label={t("routes.alternativeName")}
              value={altForm.name}
              onChange={(value) => updateAltField("name", value)}
              placeholder={t("routes.alternativeNamePlaceholder")}
              disabled={!canManageRoutes}
            />
            <StationSelect
              label={t("routes.alternativeDestination")}
              stations={stations}
              value={altForm.destinationStationId}
              placeholder={t("routes.selectAlternativeDestination")}
              onChange={(value) => updateAltField("destinationStationId", value)}
              disabled={!canManageRoutes}
            />
            <div>
              <label className={labelClass}>{t("routes.alternativeDescription")}</label>
              <textarea
                className={inputClass + " min-h-16 resize-y"}
                value={altForm.description}
                onChange={(event) =>
                  updateAltField("description", event.target.value)
                }
                placeholder={t("routes.alternativeDescriptionPlaceholder")}
                disabled={!canManageRoutes}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={altForm.isActive}
                disabled={!canManageRoutes}
                onChange={(event) => toggleAlternativeActive(event.target.checked)}
              />
              {t("routes.activeAlternative")}
            </label>
            {/* Km/phút KHÔNG còn ô nhập — tự tính từ polyline đang soạn trên map,
                chỉ hiện đọc để user biết số liệu sẽ gửi khi bấm Lưu ở toolbar. */}
            <p
              data-testid="alternative-metrics-readout"
              className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
            >
              {t("routes.alternativeMetricsReadout", {
                km: altMetrics.totalDistanceKm,
                minutes: altMetrics.estimatedDurationMinutes,
              })}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-900">
              {t("routes.alternativeStops")}
            </p>
            <div className="mt-2 space-y-2">
              {altStopDrafts.map((stop) => (
                <div
                  key={stop.stopId}
                  data-testid={`alternative-stop-row-${stop.stopId}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-gray-800">
                    #{stop.orderIndex} · {stop.stopName}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {stop.distanceFromOriginKm} km ·{" "}
                    {stop.estimatedDurationFromOriginMinutes} {t("routes.minutes")}
                  </span>
                  <button
                    type="button"
                    aria-label={t("routes.removeAlternativeStop")}
                    onClick={() => removeAltStop(stop.stopId)}
                    className="shrink-0 text-gray-400 hover:text-red-600"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
              {!altStopDrafts.length && (
                <p className="text-xs text-gray-500">{t("routes.alternativeNoStops")}</p>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500">{t("routes.suggestModeHint")}</p>
              {isLoadingSuggestions && (
                <p className="text-xs text-gray-400">{t("routes.suggestLoading")}</p>
              )}
              <StopSearchBox stops={stops} onPick={onPickSearchResult} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startNewAlternative}
              // Đủ 2/2 → luôn khoá nút tạo mới, kể cả đang xem/sửa một tuyến thay
              // thế có sẵn (bấm nút này là chuyển sang soạn bản NHÁP thứ 3, vượt
              // giới hạn) — giữ nguyên luật cũ (0/2 giới hạn).
              disabled={alternativeRoutes.length >= 2}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiPlus size={16} />
              {t("routes.newAlternative")}
            </button>
            {selectedAlternativeRouteId && (
              <button
                type="button"
                onClick={() => {
                  const alternative = alternativeRoutes.find(
                    (item) => item.id === selectedAlternativeRouteId,
                  );
                  if (alternative) {
                    setPendingDeleteAlternative(alternative);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <FiTrash2 size={16} />
                {t("routes.deleteAlternative")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
