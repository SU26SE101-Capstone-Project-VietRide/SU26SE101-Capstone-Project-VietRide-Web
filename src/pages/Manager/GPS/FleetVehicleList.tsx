import { FiMapPin } from "react-icons/fi";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FleetVehicleMapPoint } from "./FleetMap";
import { statusDotClass, statusLabel, statusRowBadge } from "./gpsHelpers";

type FleetVehicleListProps = {
  /** Danh sách đã lọc theo search + trạng thái */
  vehicles: FleetVehicleMapPoint[];
  /** Toàn bộ đội xe — dùng để tra cứu xe đang chọn ở footer */
  fleetVehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function FleetVehicleList({
  vehicles,
  fleetVehicles,
  selectedId,
  onSelect,
}: FleetVehicleListProps) {
  const { t } = useTranslation("manager");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-vehicle-id="${selectedId}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <aside className="flex max-h-[min(72vh,640px)] min-h-[320px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900">
            {t("gps.vehicleList")}
          </h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
            {vehicles.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {t("gps.selectVehicle")}
        </p>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {vehicles.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-gray-500">
            {t("gps.noMatch")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {vehicles.map((v) => {
              const active = v.id === selectedId;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    data-vehicle-id={v.id}
                    onClick={() => onSelect(v.id)}
                    className={`flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-vr-300 bg-vr-50/80 ring-1 ring-vr-200"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDotClass(v.status)}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {v.plate}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {v.driver}
                          </p>
                        </div>
                      </div>
                      <span className={statusRowBadge(v.status)}>
                        {statusLabel(v.status, t)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 truncate">
                        <FiMapPin size={12} className="shrink-0" />
                        <span className="truncate">{v.route}</span>
                      </span>
                      <span className="shrink-0 font-medium text-gray-700">
                        {v.speedKmh == null ? "—" : `${v.speedKmh} km/h`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selectedId && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 text-xs text-gray-600">
          {(() => {
            const v = fleetVehicles.find((x) => x.id === selectedId);
            if (!v) return null;
            return <p>{t("gps.pingInfo", { plate: v.plate })}</p>;
          })()}
        </div>
      )}
    </aside>
  );
}
