// Panel nổi của tab "Tuyến thay thế" — MAP-FIRST (phụ lục spec 2026-08-07):
// form gọn (tên/mô tả/bến đến/kích hoạt) + danh sách 0-2 tuyến thay thế +
// điểm dừng (chỉ đọc, thêm/gỡ qua chấm gợi ý trên map — không còn editor nhập
// tay). Km/phút KHÔNG còn ô nhập — hiện dạng chỉ đọc, tự tính từ polyline đang
// soạn trên bản đồ (xem useAlternativeRouteWorkspace).
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiGitBranch,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiSlash,
  FiTrash2,
} from "react-icons/fi";
import {
  labelClass,
  textareaClass,
} from "../../../components/form/formClasses";
import SectionHeader from "./SectionHeader";
import StopSearchBox from "./StopSearchBox";
import { Input, StationSelect } from "./formControls";
import type { UseAlternativeRouteWorkspaceResult } from "./useAlternativeRouteWorkspace";
import type { OperatorStop } from "../../../api/vietride";
import type { StationOption, StopSuggestion } from "./types";
import Checkbox from "../../../components/form/Checkbox";

type AlternativeRoutesSectionProps = {
  canManageRoutes: boolean;
  hasSelectedRoute: boolean;
  stations: StationOption[];
  stops: OperatorStop[];
  workspace: UseAlternativeRouteWorkspaceResult;
  onPickSearchResult: (result: StopSuggestion) => void;
  isLoadingSuggestions?: boolean;
  /** Còn quét được gợi ý Goong cho phương án này (chưa có kết quả, chưa bấm). */
  canRequestPlaces?: boolean;
  onRequestPlaces?: () => void;
};

export default function AlternativeRoutesSection({
  canManageRoutes,
  hasSelectedRoute,
  stations,
  stops,
  workspace,
  onPickSearchResult,
  isLoadingSuggestions = false,
  canRequestPlaces = false,
  onRequestPlaces,
}: AlternativeRoutesSectionProps) {
  const { t } = useTranslation("manager");
  const {
    alternativeRoutes,
    alternativeDetailStates,
    selectedAlternativeRouteId,
    selectedAlternative,
    isLoadingAlternativeDetail,
    alternativeDetailLoadFailed,
    alternativeDetailErrorReason,
    activeAlternativeCount,
    maxActiveAlternatives,
    altForm,
    altMetrics,
    altStopDrafts,
    altSuggestions,
    isSavingAlternative,
    startNewAlternative,
    handleSelectAlternativeRoute,
    retryAlternativeDetail,
    handleRestoreAlternativeRoute,
    updateAltField,
    toggleAlternativeActive,
    removeAltStop,
    setPendingDeleteAlternative,
  } = workspace;
  // Bản đã lưu đang mở mà ĐÃ NGƯNG áp dụng → đổi nút "Ngưng áp dụng" thành
  // "Khôi phục" (xoá mềm ở BE, xem handleDeleteAlternativeRoute)
  const isSelectedDeactivated = Boolean(
    selectedAlternative && !selectedAlternative.isActive,
  );

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
            {t("routes.alternativeCapacity", { count: activeAlternativeCount })}
          </p>
          {/* Đếm theo bản ĐANG ÁP DỤNG — bản đã ngưng vẫn nằm trong danh sách
              (xoá mềm) nhưng không chiếm chỗ, xem maxActiveAlternatives */}
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-vr-900">
            {activeAlternativeCount}/{maxActiveAlternatives}
          </span>
        </div>
        {alternativeRoutes.length > activeAlternativeCount && (
          <p className="mt-1 text-xs text-gray-500">
            {t("routes.alternativeDeactivatedCount", {
              count: alternativeRoutes.length - activeAlternativeCount,
            })}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        {alternativeRoutes.map((alternative, index) => (
          <button
            key={alternative.id}
            type="button"
            data-testid={`alternative-route-row-${alternative.id}`}
            onClick={() => handleSelectAlternativeRoute(alternative.id)}
            className={
              (selectedAlternativeRouteId === alternative.id
                ? "rounded-lg border border-vr-300 bg-vr-50 p-3 text-left ring-1 ring-vr-200"
                : "rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-vr-200 hover:bg-gray-50") +
              // Bản đã ngưng vẫn hiện (xoá mềm) nhưng làm nhạt để không nhầm là
              // đang chạy — bấm vào vẫn xem/khôi phục được
              (alternative.isActive ? "" : " opacity-70")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-vr-900">
                {t("routes.alternativeNumber", { number: index + 1 })}
              </span>
              <span
                className={
                  alternative.isActive
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                    : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500"
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
            {alternativeDetailStates[alternative.id]?.status === "loading" && (
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-vr-700">
                <FiRefreshCw className="animate-spin" size={12} />
                {t("routes.alternativeDetailLoading")}
              </span>
            )}
            {alternativeDetailStates[alternative.id]?.status === "error" && (
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                <FiAlertTriangle size={12} />
                {t("routes.alternativeDetailLoadFailedShort")}
              </span>
            )}
          </button>
        ))}
        {!alternativeRoutes.length && (
          <p className="text-sm text-gray-500">{t("routes.alternativeEmpty")}</p>
        )}
      </div>

      {isLoadingAlternativeDetail && (
        <div
          role="status"
          data-testid="alternative-detail-loading"
          className="flex items-start gap-3 rounded-lg border border-vr-200 bg-vr-50 px-3 py-3 text-sm text-vr-900"
        >
          <FiRefreshCw className="mt-0.5 shrink-0 animate-spin" size={16} />
          <div>
            <p className="font-semibold">
              {t("routes.alternativeDetailLoading")}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-vr-700">
              {t("routes.alternativeDetailLoadingHint")}
            </p>
          </div>
        </div>
      )}

      {alternativeDetailLoadFailed && (
        <div
          role="alert"
          data-testid="alternative-detail-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
        >
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={16} />
            <div>
              <p className="font-semibold">
                {alternativeDetailErrorReason === "forbidden"
                  ? t("routes.alternativeDetailForbidden")
                  : t("routes.alternativeDetailLoadFailed")}
              </p>
              <p className="mt-0.5 text-xs leading-5">
                {t("routes.alternativeDetailLoadFailedHint")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryAlternativeDetail}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <FiRefreshCw size={13} />
            {t("routes.alternativeDetailRetry")}
          </button>
        </div>
      )}

      {canManageRoutes &&
        !isLoadingAlternativeDetail &&
        !alternativeDetailLoadFailed && (
        <>
          {/* Bản đang mở đã ngưng: nói rõ dữ liệu còn nguyên, khôi phục được —
              tránh user tưởng đã mất rồi đi tạo lại từ đầu */}
          {isSelectedDeactivated && (
            <p
              data-testid="alternative-deactivated-banner"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
            >
              {t("routes.alternativeDeactivatedHint")}
            </p>
          )}
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
                className={textareaClass + " min-h-16 resize-y"}
                value={altForm.description}
                onChange={(event) =>
                  updateAltField("description", event.target.value)
                }
                placeholder={t("routes.alternativeDescriptionPlaceholder")}
                disabled={!canManageRoutes}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox
                checked={altForm.isActive}
                disabled={!canManageRoutes}
                onChange={toggleAlternativeActive}
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
                  <span
                    className="min-w-0 truncate font-medium text-gray-800"
                    title={"#" + stop.orderIndex + " - " + stop.stopName}
                  >
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
                    className="shrink-0 text-gray-500 hover:text-red-600"
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
              {/* Phân biệt "đang tìm" với "tìm xong mà rỗng" — trước đây hai
                  trạng thái trông y hệt nhau nên gợi ý hụt vì rate limit của
                  Goong trông như tính năng bị gỡ mất. */}
              {isLoadingSuggestions ? (
                <p className="text-xs text-gray-600">{t("routes.suggestLoading")}</p>
              ) : canRequestPlaces && onRequestPlaces ? (
                // Quét dọc tuyến là hàng chục lời gọi Goong nên phải do người
                // dùng chủ động — gợi ý từ kho nhà xe vẫn hiện sẵn, miễn phí.
                <button
                  type="button"
                  onClick={onRequestPlaces}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-vr-200 bg-white px-3 py-2 text-xs font-semibold text-vr-900 transition hover:bg-vr-50"
                >
                  <FiSearch size={14} />
                  {t("routes.suggestScan")}
                </button>
              ) : altSuggestions.length === 0 ? (
                <p className="text-xs text-amber-700">{t("routes.suggestEmpty")}</p>
              ) : null}
              <StopSearchBox stops={stops} onPick={onPickSearchResult} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startNewAlternative}
              // Đủ 2/2 ĐANG ÁP DỤNG → khoá nút tạo mới, kể cả đang xem/sửa một
              // tuyến thay thế có sẵn (bấm nút này là chuyển sang soạn bản NHÁP
              // thứ 3, vượt giới hạn). Bản đã ngưng không tính vào trần.
              disabled={activeAlternativeCount >= maxActiveAlternatives}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiPlus size={16} />
              {t("routes.newAlternative")}
            </button>
            {selectedAlternative &&
              (isSelectedDeactivated ? (
                <button
                  type="button"
                  data-testid="restore-alternative-button"
                  disabled={isSavingAlternative}
                  onClick={() =>
                    void handleRestoreAlternativeRoute(selectedAlternative)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <FiRotateCcw size={16} />
                  {t("routes.restoreAlternative")}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="deactivate-alternative-button"
                  onClick={() => setPendingDeleteAlternative(selectedAlternative)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  <FiSlash size={16} />
                  {t("routes.deactivateAlternative")}
                </button>
              ))}
          </div>
        </>
        )}
    </div>
  );
}
