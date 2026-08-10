// Xác nhận phường/xã trước khi tạo điểm dừng mới từ gợi ý Google Places.
//
// BE bắt buộc Stop gắn Location cấp phường/xã, và KHÔNG có API nào đổi lại sau
// khi tạo (cả operator lẫn admin PATCH đều không có field Location). Vì vậy
// phường/xã đoán từ địa chỉ Google chỉ được điền sẵn, người dùng phải nhìn và
// xác nhận — không bao giờ lưu ngầm theo phỏng đoán.
//
// Trang Routes remount component này theo id gợi ý (prop `key`), nên state khởi
// tạo được ngay từ địa chỉ và không cần effect nào để reset giữa hai lần mở.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import { getPublicLocations, type AdminLocation } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { matchProvinceCode, matchWardId } from "../../../utils/locationMatching";
import type { StopSuggestion } from "./types";

type StopWardConfirmModalProps = {
  /** Gợi ý đang chờ xác nhận; null = đóng modal */
  suggestion: StopSuggestion | null;
  /** Tỉnh/thành đã tải sẵn ở màn Routes */
  provinces: AdminLocation[];
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (locationId: string) => void;
};

export default function StopWardConfirmModal({
  suggestion,
  provinces,
  isSubmitting,
  onCancel,
  onConfirm,
}: StopWardConfirmModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const address = suggestion?.address ?? "";

  // Tỉnh đoán từ địa chỉ làm giá trị khởi tạo; người dùng đổi thì ghi đè
  const [provinceCode, setProvinceCode] = useState(() =>
    matchProvinceCode(address, undefined, provinces),
  );
  // null = chưa chạm tới, đang dùng giá trị máy đoán
  const [wardOverride, setWardOverride] = useState<string | null>(null);
  // Kết quả tải mang theo tỉnh của chính nó nên response cũ không lẫn sang tỉnh mới
  const [wardResult, setWardResult] = useState<{
    provinceCode: string;
    wards: AdminLocation[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!provinceCode) return;

    let ignore = false;
    getPublicLocations({ parentCode: provinceCode })
      .then((result) => {
        if (ignore) return;
        setWardResult({
          provinceCode,
          wards: result.filter((location) => location.isActive),
          failed: false,
        });
      })
      .catch(() => {
        if (ignore) return;
        setWardResult({ provinceCode, wards: [], failed: true });
      });

    return () => {
      ignore = true;
    };
  }, [provinceCode]);

  const isCurrentResult = wardResult?.provinceCode === provinceCode;
  const wards = useMemo(
    () => (isCurrentResult ? wardResult.wards : []),
    [isCurrentResult, wardResult],
  );
  const isLoadingWards = Boolean(provinceCode) && !isCurrentResult;
  const hasLoadError = Boolean(isCurrentResult && wardResult.failed);

  const guessedWardId = useMemo(
    () => matchWardId(address, wards),
    [address, wards],
  );
  const wardId = wardOverride ?? guessedWardId;
  const autoFilled = wardOverride === null && Boolean(guessedWardId);

  return (
    <Modal
      open={suggestion !== null}
      onClose={onCancel}
      icon={<FiMapPin />}
      title={t("routes.stopWardConfirmTitle")}
      subtitle={t("routes.stopWardConfirmSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(wardId)}
            disabled={!wardId || isSubmitting}
            className="cursor-pointer rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t("routes.stopWardConfirmSaving")
              : t("routes.stopWardConfirmSubmit")}
          </button>
        </>
      }
    >
      {suggestion && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
            <p className="font-semibold text-gray-900">{suggestion.name}</p>
            <p className="mt-1 text-sm text-gray-600">{suggestion.address}</p>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {t("routes.stopWardImmutableWarning")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("routes.stationProvince")}
              </label>
              <CustomSelect
                aria-label={t("routes.stationProvince")}
                className={inputClass}
                value={provinceCode}
                searchable
                searchPlaceholder={tc("searchOptions", {
                  label: t("routes.stationProvince"),
                })}
                emptyMessage={tc("noMatchingOptions")}
                onChange={(event) => {
                  setProvinceCode(event.target.value);
                  setWardOverride(null);
                }}
              >
                <option value="">{t("routes.selectStationProvince")}</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div>
              <label className={labelClass}>{t("routes.stationWard")}</label>
              <CustomSelect
                aria-label={t("routes.stationWard")}
                className={inputClass}
                value={wardId}
                disabled={!provinceCode || isLoadingWards}
                searchable
                searchPlaceholder={tc("searchOptions", {
                  label: t("routes.stationWard"),
                })}
                emptyMessage={tc("noMatchingOptions")}
                onChange={(event) => setWardOverride(event.target.value)}
              >
                <option value="">
                  {isLoadingWards
                    ? t("routes.loadingWards")
                    : t("routes.selectStationWard")}
                </option>
                {wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          {hasLoadError && (
            <p className="text-xs text-red-600" role="alert">
              {t("routes.wardLoadFailed")}
            </p>
          )}

          {/* Nói rõ giá trị đang hiển thị là máy đoán hay người chọn */}
          {autoFilled ? (
            <p className="text-xs text-emerald-700">
              {t("routes.stopWardAutoFilled")}
            </p>
          ) : (
            !wardId &&
            provinceCode &&
            !isLoadingWards && (
              <p className="text-xs text-gray-500">
                {t("routes.stopWardNeedsManualPick")}
              </p>
            )
          )}
        </div>
      )}
    </Modal>
  );
}
