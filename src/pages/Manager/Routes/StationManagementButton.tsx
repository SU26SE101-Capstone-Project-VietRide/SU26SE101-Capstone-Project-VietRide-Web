// Nút "Quản lý bến" của cột phải. Tách riêng để header tuyến (RouteDetailHeader)
// và trạng thái chưa chọn/chưa có tuyến (RouteDetailAside) dùng CHUNG một markup
// — trước đây mỗi nơi tự khai một bản, sửa style một bên là lệch bên kia.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";

type StationManagementButtonProps = {
  onClick: () => void;
};

export default function StationManagementButton({
  onClick,
}: StationManagementButtonProps) {
  const { t } = useTranslation("manager");

  return (
    <Button variant="secondary" onClick={onClick}>
      <FiMapPin size={16} />
      {t("routes.stationManagement")}
    </Button>
  );
}
