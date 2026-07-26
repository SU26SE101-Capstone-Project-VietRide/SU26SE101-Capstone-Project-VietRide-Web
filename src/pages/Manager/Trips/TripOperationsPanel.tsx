import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiRefreshCw, FiRepeat, FiTruck } from "react-icons/fi";
import {
  disruptOperatorTripNoSubstitution,
  getOperatorTripCargoCapacity,
  getOperatorUsers,
  getOperatorVehicles,
  substituteOperatorTripVehicle,
  type CargoCapacity,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomSelect from "../../../components/CustomSelect";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.id ?? vehicle.vehicleId ?? "";
}

function userId(user: OperatorUser) {
  return user.userId || user.id || "";
}

export default function TripOperationsPanel() {
  const { t } = useTranslation("manager");
  const canMutate = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [tripId, setTripId] = useState("");
  const [capacity, setCapacity] = useState<CargoCapacity | null>(null);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [newDriverUserId, setNewDriverUserId] = useState("");
  const [newAssistantUserId, setNewAssistantUserId] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const drivers = useMemo(
    () => users.filter((user) => user.role === "DRIVER"),
    [users],
  );
  const assistants = useMemo(
    () => users.filter((user) => user.role === "ASSISTANT"),
    [users],
  );

  useEffect(() => {
    if (!canMutate) return;

    let ignore = false;
    void Promise.all([
      getOperatorVehicles({ page: 1, pageSize: 100 }),
      getOperatorUsers({ page: 1, pageSize: 100 }),
    ])
      .then(([vehicleResult, userResult]) => {
        if (!ignore) {
          setVehicles(vehicleResult.items);
          setUsers(userResult.items);
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("tripOperations.resourcesFailed", {
                  defaultValue: "Không thể tải danh sách xe và nhân sự.",
                }),
          );
        }
      });

    return () => {
      ignore = true;
    };
  }, [canMutate, t]);

  async function loadCapacity() {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) {
      setError(
        t("tripOperations.tripRequired", {
          defaultValue: "Vui lòng nhập mã chuyến.",
        }),
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      setCapacity(await getOperatorTripCargoCapacity(normalizedTripId));
    } catch (loadError) {
      setCapacity(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.capacityFailed", {
              defaultValue: "Không thể tải sức chứa hàng hóa.",
            }),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function substituteVehicle() {
    if (!tripId.trim() || !newVehicleId || !newDriverUserId || !reason.trim()) {
      setError(
        t("tripOperations.substituteRequired", {
          defaultValue: "Mã chuyến, xe, tài xế và lý do là bắt buộc.",
        }),
      );
      return;
    }

    if (
      !window.confirm(
        t("tripOperations.substituteConfirm", {
          defaultValue: "Xác nhận thay xe cho chuyến này?",
        }),
      )
    ) {
      return;
    }

    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await substituteOperatorTripVehicle(tripId.trim(), {
        newVehicleId,
        newDriverUserId,
        newAssistantUserId: newAssistantUserId || undefined,
        reason: reason.trim(),
      });
      setMessage(
        t("tripOperations.substituteSuccess", {
          defaultValue: "Đã thay xe. Chuyến mới: {{tripId}}",
          tripId: result.newTripId ?? result.tripId,
        }),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.substituteFailed", {
              defaultValue: "Không thể thay xe cho chuyến.",
            }),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function disruptTrip() {
    if (!tripId.trim() || !reason.trim()) {
      setError(
        t("tripOperations.disruptRequired", {
          defaultValue: "Mã chuyến và lý do là bắt buộc.",
        }),
      );
      return;
    }

    if (
      !window.confirm(
        t("tripOperations.disruptConfirm", {
          defaultValue:
            "Xác nhận kết thúc chuyến do không có xe thay thế? Thao tác này không thể hoàn tác.",
        }),
      )
    ) {
      return;
    }

    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await disruptOperatorTripNoSubstitution(tripId.trim(), {
        reason: reason.trim(),
      });
      setMessage(
        t("tripOperations.disruptSuccess", {
          defaultValue: "Đã ghi nhận gián đoạn chuyến ({{status}}).",
          status: result.status ?? result.tripId,
        }),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.disruptFailed", {
              defaultValue: "Không thể ghi nhận gián đoạn chuyến.",
            }),
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiTruck className="text-vr-700" />
            {t("tripOperations.title", {
              defaultValue: "Vận hành chuyến đã phát sinh",
            })}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("tripOperations.subtitle", {
              defaultValue:
                "Tra cứu tải hàng cho cả hai role; thay xe hoặc kết thúc chuyến chỉ dành cho quản trị nhà xe.",
            })}
          </p>
        </div>
        {!canMutate && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {t("tripOperations.readOnly", { defaultValue: "Chỉ xem" })}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={tripId}
          onChange={(event) => {
            setTripId(event.target.value);
            setCapacity(null);
          }}
          className={inputClass}
          placeholder={t("tripOperations.tripPlaceholder", {
            defaultValue: "UUID chuyến",
          })}
        />
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadCapacity()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {t("tripOperations.loadCapacity", { defaultValue: "Tải sức chứa" })}
        </button>
      </div>

      {capacity && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CapacityMetric
            label={t("tripOperations.maxWeight", {
              defaultValue: "Tải trọng tối đa",
            })}
            value={`${capacity.maxCargoWeightKg.toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.reservedWeight", {
              defaultValue: "Đã giữ chỗ",
            })}
            value={`${(
              capacity.reservedCargoWeightKg ??
              capacity.reservedWeightKg ??
              0
            ).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.loadedWeight", {
              defaultValue: "Đã xếp",
            })}
            value={`${(capacity.loadedWeightKg ?? 0).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.percentFull", {
              defaultValue: "Mức sử dụng",
            })}
            value={`${(capacity.percentFull ?? 0).toLocaleString("vi-VN")}%`}
          />
        </div>
      )}

      {canMutate && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.vehicle", { defaultValue: "Xe thay thế" })}
              </span>
              <CustomSelect
                value={newVehicleId}
                onChange={(event) => setNewVehicleId(event.target.value)}
                className={inputClass}
              >
                <option value="">
                  {t("tripOperations.selectVehicle", { defaultValue: "Chọn xe" })}
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicleId(vehicle)} value={vehicleId(vehicle)}>
                    {vehicle.licensePlate}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.driver", { defaultValue: "Tài xế mới" })}
              </span>
              <CustomSelect
                value={newDriverUserId}
                onChange={(event) => setNewDriverUserId(event.target.value)}
                className={inputClass}
              >
                <option value="">
                  {t("tripOperations.selectDriver", {
                    defaultValue: "Chọn tài xế",
                  })}
                </option>
                {drivers.map((driver) => (
                  <option key={userId(driver)} value={userId(driver)}>
                    {driver.displayName}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.assistant", {
                  defaultValue: "Phụ xe mới (không bắt buộc)",
                })}
              </span>
              <CustomSelect
                value={newAssistantUserId}
                onChange={(event) => setNewAssistantUserId(event.target.value)}
                className={inputClass}
              >
                <option value="">
                  {t("tripOperations.noAssistant", {
                    defaultValue: "Không chọn phụ xe",
                  })}
                </option>
                {assistants.map((assistant) => (
                  <option key={userId(assistant)} value={userId(assistant)}>
                    {assistant.displayName}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.reason", { defaultValue: "Lý do" })}
              </span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
                maxLength={500}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isMutating}
              onClick={() => void substituteVehicle()}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <FiRepeat />
              {t("tripOperations.substitute", { defaultValue: "Thay xe" })}
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => void disruptTrip()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              <FiAlertTriangle />
              {t("tripOperations.disrupt", {
                defaultValue: "Không có xe thay thế",
              })}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function CapacityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
