import React from "react";
import { useTranslation } from "react-i18next";
import { useVehicleStore } from "../stores/vehicleStore";
import type { SeatType } from "../types";
import { FiTrash2 } from "react-icons/fi";

const SEAT_TYPES: SeatType[] = ["NORMAL", "VIP", "BED", "DRIVER"];

export const PropertiesPanel: React.FC = () => {
  const { t } = useTranslation("manager");
  const { currentVehicle, selectedSeatId, updateSeat, removeSeat } =
    useVehicleStore();

  const selectedSeat = currentVehicle?.seats.find(
    (s) => s.id === selectedSeatId,
  );

  if (!selectedSeat) {
    return (
      <div className="w-64 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">
          {t("vehicleBuilder.properties")}
        </h2>
        <div className="text-gray-500 text-sm">
          {t("vehicleBuilder.selectSeatHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white rounded-lg shadow p-4 space-y-4 overflow-y-auto max-h-[600px]">
      <h2 className="text-lg font-semibold">
        {t("vehicleBuilder.seatProperties")}
      </h2>

      {/* Seat ID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.seatCode")}
        </label>
        <input
          type="text"
          value={selectedSeat.label}
          onChange={(e) =>
            updateSeat(selectedSeat.id, { label: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Seat Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.seatType")}
        </label>
        <select
          value={selectedSeat.type}
          onChange={(e) =>
            updateSeat(selectedSeat.id, { type: e.target.value as SeatType })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {SEAT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`vehicleBuilder.seatTypes.${type}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Position X */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.positionX", { value: Math.round(selectedSeat.x) })}
        </label>
        <input
          type="range"
          min="0"
          max="750"
          value={selectedSeat.x}
          onChange={(e) =>
            updateSeat(selectedSeat.id, { x: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </div>

      {/* Position Y */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.positionY", { value: Math.round(selectedSeat.y) })}
        </label>
        <input
          type="range"
          min="0"
          max="550"
          value={selectedSeat.y}
          onChange={(e) =>
            updateSeat(selectedSeat.id, { y: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </div>

      {/* Rotation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.rotation", { value: selectedSeat.rotation })}
        </label>
        <div className="flex gap-2">
          {[0, 90, 180, 270].map((angle) => (
            <button
              key={angle}
              onClick={() => updateSeat(selectedSeat.id, { rotation: angle })}
              className={`flex-1 px-2 py-1 rounded text-sm ${
                selectedSeat.rotation === angle
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {angle}°
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("vehicleBuilder.color")}
        </label>
        <div className="flex gap-2">
          {["#3b82f6", "#f59e0b", "#ec4899", "#10b981", "#ef4444"].map(
            (color) => (
              <button
                key={color}
                onClick={() => updateSeat(selectedSeat.id, { color })}
                className={`w-10 h-10 rounded border-2 ${
                  selectedSeat.color === color
                    ? "border-gray-800"
                    : "border-gray-300"
                }`}
                style={{ backgroundColor: color }}
              />
            ),
          )}
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("vehicleBuilder.status")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedSeat.enabled}
            onChange={(e) =>
              updateSeat(selectedSeat.id, { enabled: e.target.checked })
            }
          />
          {t("vehicleBuilder.enableSeat")}
        </label>
      </div>

      {/* Delete Button */}
      <div className="border-t pt-4">
        <button
          onClick={() => removeSeat(selectedSeat.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
        >
          <FiTrash2 size={16} />
          {t("vehicleBuilder.deleteSeat")}
        </button>
      </div>
    </div>
  );
};
