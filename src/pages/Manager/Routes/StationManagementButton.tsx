// Nút "Quản lý bến" của cột phải. Tách riêng để header tuyến (RouteDetailHeader)
// và trạng thái chưa chọn/chưa có tuyến (RouteDetailAside) dùng CHUNG một markup
// — trước đây mỗi nơi tự khai một bản, sửa style một bên là lệch bên kia.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";

type StationManagementButtonProps = {
  onClick: () => void;
};

export default function StationManagementButton({
  onClick,
}: StationManagementButtonProps) {
  const { t } = useTranslation("manager");

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
    >
      <FiMapPin size={16} />
      {t("routes.stationManagement")}
    </button>
  );
}
