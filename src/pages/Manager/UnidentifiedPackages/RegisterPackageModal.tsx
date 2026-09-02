// Đăng ký một kiện hàng chưa định danh tại bến (§10.4).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiHelpCircle } from "react-icons/fi";
import {
  getOperatorStations,
  getOperatorStops,
  getOperatorTrips,
  getOperatorVehicles,
  PARCEL_CUSTODY_LOCATION_TYPES,
  registerUnidentifiedPackage,
  type OperatorStation,
  type OperatorStop,
  type OperatorTripListItem,
  type OperatorVehicle,
  type UnidentifiedPackage,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import EvidenceUploader from "../../../components/EvidenceUploader";
import { formatDateTime } from "../../../utils/date";
import {
  parseRegisterPackageDraft,
  type RegisterPackageDraft,
  unidentifiedErrorTranslationKey,
} from "./unidentifiedHelpers";

type RegisterPackageModalProps = {
  open: boolean;
  onClose: () => void;
  onRegistered: (created: UnidentifiedPackage, message: string) => void;
};

const emptyDraft: RegisterPackageDraft = {
  temporaryExceptionTag: "",
  tripId: "",
  locationType: "WAREHOUSE",
  locationId: "",
  locationSnapshot: "",
  description: "",
  observedWeightKg: "",
  evidenceReferences: [],
};

const RESOURCE_PAGE_SIZE = 100;

function stationValue(station: OperatorStation) {
  return station.stationId ?? station.id ?? "";
}

function stationLabel(station: OperatorStation) {
  return (
    station.displayNameOverride?.trim() ||
    station.station?.name?.trim() ||
    station.counterLocation?.trim() ||
    ""
  );
}

function vehicleValue(vehicle: OperatorVehicle) {
  return vehicle.vehicleId ?? vehicle.id ?? "";
}

function tripLabel(trip: OperatorTripListItem) {
  const route =
    trip.route.originName && trip.route.destinationName
      ? `${trip.route.originName} → ${trip.route.destinationName}`
      : trip.route.name;
  return [
    trip.tripCode,
    route,
    formatDateTime(trip.departureAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function RegisterPackageModal({
  open,
  onClose,
  onRegistered,
}: RegisterPackageModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [draft, setDraft] = useState<RegisterPackageDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [resourceWarning, setResourceWarning] = useState("");
  const [stations, setStations] = useState<OperatorStation[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [trips, setTrips] = useState<OperatorTripListItem[]>([]);

  useEffect(() => {
    if (!open || resourcesLoaded) return;

    let ignore = false;
    void Promise.allSettled([
      getOperatorStations({
        page: 1,
        pageSize: RESOURCE_PAGE_SIZE,
        isActive: true,
        sortBy: "name",
        sortDir: "asc",
      }),
      getOperatorStops({
        page: 1,
        pageSize: RESOURCE_PAGE_SIZE,
        isActive: true,
      }),
      getOperatorVehicles({
        page: 1,
        pageSize: RESOURCE_PAGE_SIZE,
        isActive: true,
      }),
      getOperatorTrips({ page: 1, pageSize: RESOURCE_PAGE_SIZE }),
    ]).then((results) => {
      if (ignore) return;

      const [stationResult, stopResult, vehicleResult, tripResult] = results;
      if (stationResult.status === "fulfilled") {
        setStations(stationResult.value.items);
      }
      if (stopResult.status === "fulfilled") setStops(stopResult.value.items);
      if (vehicleResult.status === "fulfilled") {
        setVehicles(vehicleResult.value.items);
      }
      if (tripResult.status === "fulfilled") setTrips(tripResult.value.items);

      if (results.some((result) => result.status === "rejected")) {
        setResourceWarning(t("unidentifiedPackages.resourceLoadWarning"));
      }
      setResourcesLoaded(true);
    });

    return () => {
      ignore = true;
    };
  }, [open, resourcesLoaded, t]);

  const locationOptions = useMemo(() => {
    switch (draft.locationType) {
      case "ROUTE_STOP":
        return stops.map((stop) => ({ value: stop.id, label: stop.name }));
      case "VEHICLE":
        return vehicles
          .map((vehicle) => ({
            value: vehicleValue(vehicle),
            label: vehicle.licensePlate,
          }))
          .filter((item) => item.value);
      case "ORIGIN_STATION":
      case "DESTINATION_STATION":
      case "WAREHOUSE":
      default:
        return stations
          .map((station) => ({
            value: stationValue(station),
            label: stationLabel(station),
          }))
          .filter((item) => item.value && item.label);
    }
  }, [draft.locationType, stations, stops, vehicles]);

  function update<K extends keyof RegisterPackageDraft>(
    key: K,
    value: RegisterPackageDraft[K],
  ) {
    setError("");
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setDraft(emptyDraft);
    setError("");
    if (resourceWarning) {
      setResourcesLoaded(false);
      setResourceWarning("");
    }
    onClose();
  }

  function selectLocation(value: string) {
    const selected = locationOptions.find((item) => item.value === value);
    setError("");
    setDraft((prev) => ({
      ...prev,
      locationId: value,
      locationSnapshot: selected?.label ?? prev.locationSnapshot,
    }));
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const parsed = parseRegisterPackageDraft(draft);
    if (!parsed.ok) {
      setError(t(`unidentifiedPackages.registerErrors.${parsed.error}`));
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const created = await registerUnidentifiedPackage(parsed.value);
      setDraft(emptyDraft);
      onRegistered(created, t("unidentifiedPackages.registerSuccess"));
    } catch (err) {
      setError(
        t(
          unidentifiedErrorTranslationKey(
            err,
            "unidentifiedPackages.registerFailed",
          ),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      icon={<FiHelpCircle size={20} />}
      title={t("unidentifiedPackages.registerTitle")}
      subtitle={t("unidentifiedPackages.registerSubtitle")}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {t("unidentifiedPackages.registerSubmit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <InlineAlert tone="error">
            <p>{error}</p>
          </InlineAlert>
        ) : null}

        {resourceWarning ? (
          <InlineAlert tone="warning">
            <p>{resourceWarning}</p>
          </InlineAlert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="package-tag">
              {t("unidentifiedPackages.tagLabel")}
              <span className="text-rose-700"> *</span>
            </label>
            <input
              id="package-tag"
              type="text"
              value={draft.temporaryExceptionTag}
              onChange={(event) =>
                update("temporaryExceptionTag", event.target.value)
              }
              placeholder={t("unidentifiedPackages.tagPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {t("unidentifiedPackages.tripLabel")}
            </label>
            <CustomSelect
              aria-label={t("unidentifiedPackages.tripLabel")}
              className={inputClass}
              value={draft.tripId}
              onChange={(event) => update("tripId", event.target.value)}
              searchable
              searchPlaceholder={t(
                "unidentifiedPackages.tripSearchPlaceholder",
              )}
              emptyMessage={t("unidentifiedPackages.tripEmpty")}
              disabled={!resourcesLoaded}
            >
              <option value="">
                {t("unidentifiedPackages.noTripOption")}
              </option>
              {trips.map((trip) => (
                <option key={trip.tripId} value={trip.tripId}>
                  {tripLabel(trip)}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <label className={labelClass}>
              {t("unidentifiedPackages.locationTypeLabel")}
              <span className="text-rose-700"> *</span>
            </label>
            <CustomSelect
              aria-label={t("unidentifiedPackages.locationTypeLabel")}
              className={inputClass}
              value={draft.locationType}
              onChange={(event) => {
                setError("");
                setDraft((prev) => ({
                  ...prev,
                  locationType: event.target.value,
                  locationId: "",
                  locationSnapshot: "",
                }));
              }}
            >
              {PARCEL_CUSTODY_LOCATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`parcelIncidents.locationTypes.${value}`, {
                    defaultValue: t(
                      "unidentifiedPackages.unknownLocationType",
                    ),
                  })}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <label className={labelClass}>
              {t(
                `unidentifiedPackages.locationSelectorLabel.${draft.locationType}`,
                {
                  defaultValue: t(
                    "unidentifiedPackages.locationSelectorLabel.DEFAULT",
                  ),
                },
              )}
              <span className="text-rose-700"> *</span>
            </label>
            <CustomSelect
              aria-label={t("unidentifiedPackages.locationLabel")}
              className={inputClass}
              value={draft.locationId}
              onChange={(event) => selectLocation(event.target.value)}
              searchable
              searchPlaceholder={t(
                "unidentifiedPackages.locationSearchPlaceholder",
              )}
              emptyMessage={t("unidentifiedPackages.locationEmpty")}
              disabled={!resourcesLoaded}
            >
              <option value="">
                {t("unidentifiedPackages.locationPlaceholder")}
              </option>
              {locationOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </CustomSelect>
            <p className="mt-1 text-xs text-gray-600">
              {t("unidentifiedPackages.locationHint")}
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="package-location-snapshot">
              {t("unidentifiedPackages.locationSnapshotLabel")}
            </label>
            <input
              id="package-location-snapshot"
              type="text"
              value={draft.locationSnapshot}
              onChange={(event) =>
                update("locationSnapshot", event.target.value)
              }
              placeholder={t("unidentifiedPackages.optionalPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="package-weight">
              {t("unidentifiedPackages.weightLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="package-weight"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={draft.observedWeightKg}
                onChange={(event) =>
                  update("observedWeightKg", event.target.value)
                }
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-gray-500">kg</span>
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="package-description">
            {t("unidentifiedPackages.descriptionLabel")}
            <span className="text-rose-700"> *</span>
          </label>
          <textarea
            id="package-description"
            rows={2}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder={t("unidentifiedPackages.descriptionPlaceholder")}
            className={textareaClass}
          />
        </div>

        <EvidenceUploader
          purpose="PARCEL_EVIDENCE_PHOTO"
          required
          value={draft.evidenceReferences}
          onChange={(next) => update("evidenceReferences", next)}
          label={t("unidentifiedPackages.evidenceLabel")}
          hint={t("unidentifiedPackages.evidenceHint")}
        />
      </div>
    </Modal>
  );
}
