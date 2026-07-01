import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useVehicleStore } from "../stores/vehicleStore";
import type { VehicleType } from "../types";

interface VehicleCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VEHICLE_TYPES: VehicleType[] = ["SEAT", "SLEEPER", "LIMO"];

const VEHICLE_MODELS = [
  "HYUNDAI_UNIVERSE",
  "THACO_MOBIHOME",
  "SAMCO",
  "COUNTY",
];

export const VehicleCreationModal: React.FC<VehicleCreationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation("manager");
  const { createNewVehicle, addVehicle } = useVehicleStore();
  const [vehicleType, setVehicleType] = useState<VehicleType>("SEAT");
  const [model, setModel] = useState("HYUNDAI_UNIVERSE");
  const [name, setName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  const handleCreate = () => {
    if (!name || !plateNumber) {
      alert(t("vehicleBuilder.createRequired"));
      return;
    }

    createNewVehicle(name, plateNumber, vehicleType, model);

    // Save to vehicle list
    const newVehicle = {
      id: `vehicle_${Date.now()}`,
      name,
      plateNumber,
      type: vehicleType,
      model,
      seats: [],
      rows: 0,
      cols: 0,
      totalCapacity: 0,
    };

    addVehicle(newVehicle);

    // Reset form
    setName("");
    setPlateNumber("");
    setVehicleType("SEAT");
    setModel("HYUNDAI_UNIVERSE");

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 space-y-4">
        <h2 className="text-2xl font-bold">
          {t("vehicleBuilder.createVehicle")}
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("vehicleBuilder.vehicleName")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("vehicleBuilder.vehicleNamePlaceholder")}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("vehicleBuilder.plateNumber")}
          </label>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            placeholder={t("vehicleBuilder.plateNumberPlaceholder")}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("vehicleBuilder.vehicleType")}
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`vehicleBuilder.vehicleTypes.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("vehicleBuilder.vehicleModel")}
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {VEHICLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleCreate}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-medium"
          >
            {t("vehicleBuilder.create")}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-medium"
          >
            {t("vehicleBuilder.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};
