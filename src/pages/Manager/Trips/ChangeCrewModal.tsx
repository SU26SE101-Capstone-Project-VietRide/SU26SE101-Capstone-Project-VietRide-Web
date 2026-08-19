// Modal đổi tài xế/phụ xe của một lịch chạy — tách file riêng theo §2.
import { useTranslation } from "react-i18next";
import { FiUsers } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { inputClass } from "../../../components/form/formClasses";
import CustomSelect from "../../../components/CustomSelect";
import { FieldLabel } from "./formControls";
import type { StaffOption, TripSchedule } from "./types";
import { Button } from "../../../components/ui/Button";

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
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {tc("cancel")}
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={isSaving || !form.driverId}>
            <FiUsers />
            {t("trips.changeCrewAction")}
          </Button>
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
