import React from "react";
import { useTranslation } from "react-i18next";
import { useVehicleStore } from "../stores/vehicleStore";
import type { SeatType } from "../types";
import { FiPlus, FiGrid, FiTrash2 } from "react-icons/fi";

export const Toolbox: React.FC = () => {
  const { t } = useTranslation("manager");
  const { currentVehicle, addSeat, generateDefaultLayout, clearLayout } =
    useVehicleStore();

  const addSeatOfType = (type: SeatType) => {
    if (!currentVehicle) return;

    const newSeat = {
      id: `seat_${Date.now()}`,
      type,
      x: Math.random() * 500 + 100,
      y: Math.random() * 300 + 100,
      rotation: 0,
      label: `${type}_${Date.now()}`,
      enabled: true,
      color:
        type === "VIP"
          ? "#f59e0b"
          : type === "BED"
            ? "#ec4899"
            : type === "DRIVER"
              ? "#10b981"
              : "#3b82f6",
      width: type === "BED" ? 100 : 50,
      height: type === "BED" ? 150 : 50,
    };

    addSeat(newSeat);
  };

  const handleGenerateLayout = () => {
    const rows = prompt(t("vehicleBuilder.rowsPrompt"), "10");
    const cols = prompt(t("vehicleBuilder.colsPrompt"), "4");

    if (rows && cols) {
      generateDefaultLayout(parseInt(rows), parseInt(cols));
    }
  };

  return (
    <div className="w-64 bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t("vehicleBuilder.tools")}</h2>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          {t("vehicleBuilder.addSeat")}
        </h3>
        <button
          onClick={() => addSeatOfType("NORMAL")}
          className="w-full flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          <FiPlus size={16} />
          {t("vehicleBuilder.addNormalSeat")}
        </button>
        <button
          onClick={() => addSeatOfType("VIP")}
          className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
        >
          <FiPlus size={16} />
          {t("vehicleBuilder.addVipSeat")}
        </button>
        <button
          onClick={() => addSeatOfType("BED")}
          className="w-full flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm"
        >
          <FiPlus size={16} />
          {t("vehicleBuilder.addBedSeat")}
        </button>
        <button
          onClick={() => addSeatOfType("DRIVER")}
          className="w-full flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
        >
          <FiPlus size={16} />
          {t("vehicleBuilder.addDriverSeat")}
        </button>
      </div>

      <div className="border-t pt-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          {t("vehicleBuilder.autoLayout")}
        </h3>
        <button
          onClick={handleGenerateLayout}
          className="w-full flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm"
        >
          <FiGrid size={16} />
          {t("vehicleBuilder.createGrid")}
        </button>
      </div>

      <div className="border-t pt-4">
        <button
          onClick={clearLayout}
          className="w-full flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
        >
          <FiTrash2 size={16} />
          {t("vehicleBuilder.clearAll")}
        </button>
      </div>

      <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
        <p className="font-medium mb-2">{t("vehicleBuilder.guideTitle")}</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>{t("vehicleBuilder.guideDrag")}</li>
          <li>{t("vehicleBuilder.guideClick")}</li>
          <li>{t("vehicleBuilder.guidePanel")}</li>
        </ul>
      </div>
    </div>
  );
};
