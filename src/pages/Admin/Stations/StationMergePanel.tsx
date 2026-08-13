// Panel gộp trạm trùng lặp (cột phải của aside): chọn trạm đích rồi merge
import { useTranslation } from "react-i18next";
import { FiGitMerge } from "react-icons/fi";
import { type AdminStation } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import { inputClass, labelClass } from "./stationHelpers";

type StationMergePanelProps = {
  selectedStation: AdminStation;
  /** Một trang kết quả từ list API, lọc theo `mergeSearch` — không phải toàn bộ bến */
  stations: AdminStation[];
  mergeTargetId: string;
  mergeSearch: string;
  isLoadingCandidates: boolean;
  isSaving: boolean;
  onMergeSearchChange: (value: string) => void;
  onMergeTargetChange: (stationId: string) => void;
  onMerge: () => void;
};

export default function StationMergePanel({
  selectedStation,
  stations,
  mergeTargetId,
  mergeSearch,
  isLoadingCandidates,
  isSaving,
  onMergeSearchChange,
  onMergeTargetChange,
  onMerge,
}: StationMergePanelProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const candidates = stations.filter(
    (station) => station.id !== selectedStation.id,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-bold text-gray-900">
        {t("stations.mergeTitle")}
      </h2>
      <p className="mt-1 text-sm text-gray-500">{t("stations.mergeHint")}</p>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-xs font-semibold text-slate-500">
          {t("stations.mergeSource")}
        </p>
        <p className="mt-1 font-semibold text-slate-900">
          {selectedStation.name}
        </p>
      </div>
      {/*
        Danh sách bến đích lấy từ list API theo từ khoá, không phải toàn bộ bến:
        bảng chính đã phân trang server-side nên không còn giữ đủ dữ liệu để
        dựng dropdown này.
      */}
      <label className="mt-4 block">
        <span className={labelClass}>{t("stations.mergeSearchLabel")}</span>
        <input
          type="search"
          className={inputClass}
          value={mergeSearch}
          onChange={(event) => onMergeSearchChange(event.target.value)}
          placeholder={t("stations.mergeSearchPlaceholder")}
        />
      </label>
      <label className="mt-4 block">
        <span className={labelClass}>{t("stations.mergeTarget")}</span>
        <CustomSelect
          className={inputClass}
          value={mergeTargetId}
          onChange={(event) => onMergeTargetChange(event.target.value)}
          disabled={isLoadingCandidates || candidates.length === 0}
        >
          <option value="">
            {isLoadingCandidates
              ? tc("loading")
              : candidates.length === 0
                ? t("stations.mergeNoCandidate")
                : t("stations.mergeTargetPlaceholder")}
          </option>
          {candidates.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name} - {station.city}
            </option>
          ))}
        </CustomSelect>
      </label>
      <button
        type="button"
        onClick={onMerge}
        disabled={isSaving || !mergeTargetId}
        className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiGitMerge />
        {t("stations.merge")}
      </button>
      <p className="mt-3 text-xs text-slate-500">{t("stations.mergeRule")}</p>
    </div>
  );
}
