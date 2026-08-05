// Modal phân công xe trung chuyển cho một yêu cầu — tách từ index.tsx.
import { useTranslation } from "react-i18next";
import Modal from "../../../components/Modal";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import type {
  RequestType,
  ShuttleDriver,
  ShuttleRequest,
  ShuttleVehicle,
} from "./dispatchHelpers";

export type AssignVehicleForm = {
  vehicleId: string;
  driverId: string;
  scheduledDepartureTime: string;
  scheduledEndTime: string;
  notes: string;
};

type AssignVehicleModalProps = {
  open: boolean;
  onClose: () => void;
  request: ShuttleRequest | null;
  vehicles: ShuttleVehicle[];
  drivers: ShuttleDriver[];
  form: AssignVehicleForm;
  onFormChange: (form: AssignVehicleForm) => void;
  onSubmit: () => void;
  requestTypeLabel: (type: RequestType) => string;
};

export default function AssignVehicleModal({
  open,
  onClose,
  request,
  vehicles,
  drivers,
  form,
  onFormChange,
  onSubmit,
  requestTypeLabel,
}: AssignVehicleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dispatch.assignTitle")}
      wide
    >
      {request && (
        <div className="space-y-4">
          <div className="bg-vr-50 border border-vr-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900">
              {t("dispatch.requestInfo")}
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div>
                <span className="text-gray-600">
                  {t("dispatch.requestCode")}
                </span>{" "}
                {request.id}
              </div>
              <div>
                <span className="text-gray-600">
                  {t("dispatch.customerLabel")}
                </span>{" "}
                {request.customerName}
              </div>
              <div>
                <span className="text-gray-600">
                  {t("dispatch.tripLabel")}
                </span>{" "}
                {request.trip}
              </div>
              <div>
                <span className="text-gray-600">
                  {t("dispatch.typeLabel")}
                </span>{" "}
                {requestTypeLabel(request.type)}
              </div>
              <div>
                <span className="text-gray-600">
                  {t("dispatch.addressLabel")}
                </span>{" "}
                {request.address}
              </div>
              <div>
                <span className="text-gray-600">
                  {t("dispatch.timeLabel")}
                </span>{" "}
                {request.time}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("dispatch.selectVehicle")}
            </label>
            <CustomSelect
              value={form.vehicleId}
              onChange={(e) =>
                onFormChange({ ...form, vehicleId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
            >
              <option value="">{t("dispatch.selectVehiclePlaceholder")}</option>
              {vehicles.filter((v) => v.status !== "idle").map((v) => (
                <option key={v.id} value={v.id}>
                  {t("dispatch.vehicleOption", {
                    plate: v.plate,
                    model: v.vehicleModel,
                    capacity: v.capacity,
                    driver: "",
                  })}
                </option>
              ))}
            </CustomSelect>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("dispatch.driverLabel")}
            </label>
            <CustomSelect
              value={form.driverId}
              onChange={(e) =>
                onFormChange({ ...form, driverId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
            >
              <option value="">{t("dispatch.selectDriverPlaceholder")}</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} {driver.phone ? `- ${formatVietnamPhoneForDisplay(driver.phone)}` : ""}
                </option>
              ))}
            </CustomSelect>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("dispatch.scheduledDeparture")}
              </label>
              <CustomDateTimeInput
                type="datetime-local"
                value={form.scheduledDepartureTime}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    scheduledDepartureTime: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("dispatch.scheduledEnd")}
              </label>
              <CustomDateTimeInput
                type="datetime-local"
                value={form.scheduledEndTime}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    scheduledEndTime: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tc("note")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                onFormChange({ ...form, notes: e.target.value })
              }
              placeholder={t("dispatch.driverNotesPlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
            >
              {t("dispatch.assignVehicle")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
