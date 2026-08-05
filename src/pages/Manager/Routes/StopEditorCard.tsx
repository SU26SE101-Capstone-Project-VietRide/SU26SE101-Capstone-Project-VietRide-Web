// Card tạo/cập nhật điểm dừng (PlacePicker + mô tả) trong section route stops
import { useTranslation } from "react-i18next";
import { FiPlus, FiSave } from "react-icons/fi";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import InlineFeedback from "./InlineFeedback";
import { Input } from "./formControls";

type StopEditorCardProps = {
  selectedStopPlace: PlaceSelection | null;
  onSelectPlace: (place: PlaceSelection) => void;
  description: string;
  onChangeDescription: (value: string) => void;
  onCreateStop: () => void;
  onUpdateStop: () => void;
  canUpdate: boolean;
  feedbackMessage: string;
};

export default function StopEditorCard({
  selectedStopPlace,
  onSelectPlace,
  description,
  onChangeDescription,
  onCreateStop,
  onUpdateStop,
  canUpdate,
  feedbackMessage,
}: StopEditorCardProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-bold text-gray-900">
        {t("routes.stopCreateTitle")}
      </p>
      <div className="mt-3 space-y-3">
        <PlacePicker
          label={t("routes.stopName")}
          placeholder={t("routes.stopNamePlaceholder")}
          selectedPlace={selectedStopPlace}
          onSelect={onSelectPlace}
        />
        <Input
          label={t("routes.description")}
          value={description}
          onChange={onChangeDescription}
          placeholder={t("routes.stopDescriptionPlaceholder")}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateStop}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiPlus size={16} />
            {t("routes.createStop")}
          </button>
          <button
            type="button"
            onClick={onUpdateStop}
            disabled={!canUpdate}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FiSave size={16} />
            {t("routes.updateStop")}
          </button>
        </div>
      </div>
      <InlineFeedback message={feedbackMessage} />
    </div>
  );
}
