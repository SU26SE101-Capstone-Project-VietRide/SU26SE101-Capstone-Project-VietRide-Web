// Modal đổi tài xế/phụ xe của một lịch chạy — tách file riêng theo §2.
import { useTranslation } from "react-i18next";
import { FiUsers } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { inputClass } from "../../../components/form/formClasses";
import CustomSelect from "../../../components/CustomSelect";
import { FieldLabel } from "./formControls";
import type { StaffOption, TripSchedule } from "./types";

export type ChangeCrewForm = {
  driverId: string;
  assistantId: string;
};

type ChangeCrewModalProps = {
  schedule: TripSchedule | null;
  form: ChangeCrewForm;
  drivers: StaffOption[];
  assistants: StaffOption[];
  isSaving: boolean;
  onFormChange: (form: ChangeCrewForm) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ChangeCrewModal({
  schedule,
  form,
  drivers,
  assistants,
  isSaving,
  onFormChange,
  onClose,
  onSubmit,
}: ChangeCrewModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={schedule !== null}
      onClose={onClose}
      icon={<FiUsers />}
      title={t("trips.changeCrew")}
      subtitle={t("trips.changeCrewSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving || !form.driverId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiUsers />
            {t("trips.changeCrewAction")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Alias /crew luôn chạy applyTo=ALL_PENDING nên nó cascade sang cả các
            chuyến SCHEDULED/BOARDING đã sinh — phải nói rõ để không ai tưởng
            chỉ đổi lịch tương lai như nhánh FUTURE_ONLY của modal sửa. */}
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("trips.changeCrewCascadeNotice")}
        </p>

        <div>
          <FieldLabel label={t("trips.driver")} required />
          <CustomSelect
            value={form.driverId}
            onChange={(event) =>
              onFormChange({ ...form, driverId: event.target.value })
            }
            className={inputClass}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </CustomSelect>
        </div>

        <div>
          <FieldLabel label={t("trips.assistant")} />
          <CustomSelect
            value={form.assistantId}
            onChange={(event) =>
              onFormChange({ ...form, assistantId: event.target.value })
            }
            className={inputClass}
          >
            {/* "" = gửi null để xoá phụ xe khỏi lịch. */}
            <option value="">{t("trips.noAssistant")}</option>
            {assistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.name}
              </option>
            ))}
          </CustomSelect>
        </div>
      </div>
    </Modal>
  );
}
