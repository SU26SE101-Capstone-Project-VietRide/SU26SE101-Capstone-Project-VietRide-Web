// Modal (wide) bọc StationManagementPanel — mở từ nút "Quản lý bến" ở header
// cột phải hoặc nút "+ Tạo bến mới" cạnh dropdown chọn bến trong form tuyến.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import Modal from "../../../components/Modal";
import type { AdminLocation } from "../../../api/vietride";
import StationManagementPanel from "./StationManagementPanel";
import type { UseStationManagementResult } from "./useStationManagement";

type StationManagementModalProps = {
  open: boolean;
  onClose: () => void;
  canManageRoutes: boolean;
  locations: AdminLocation[];
  manager: UseStationManagementResult;
  onRunAction: (action: () => Promise<void>) => void;
};

export default function StationManagementModal({
  open,
  onClose,
  canManageRoutes,
  locations,
  manager,
  onRunAction,
}: StationManagementModalProps) {
  const { t } = useTranslation("manager");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("routes.stationManagement")}
      subtitle={t("routes.stationManagementHint")}
      icon={<FiMapPin />}
      wide
    >
      <StationManagementPanel
        canManageRoutes={canManageRoutes}
        locations={locations}
        manager={manager}
        onRunAction={onRunAction}
      />
    </Modal>
  );
}
