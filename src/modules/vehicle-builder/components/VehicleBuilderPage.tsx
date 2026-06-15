import React, { useState } from "react";
import { useVehicleStore } from "../stores/vehicleStore";
import { Canvas2D } from "../canvas/Canvas2D";
import { Toolbox } from "./Toolbox";
import { PropertiesPanel } from "./PropertiesPanel";
import { VehicleCreationModal } from "./VehicleCreationModal";
import { FiPlus, FiDownload, FiUpload } from "react-icons/fi";

export const VehicleBuilderPage: React.FC = () => {
  const {
    currentVehicle,
    vehicles,
    setCurrentVehicle,
    saveLayout,
    loadLayout,
  } = useVehicleStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveLayout = () => {
    if (!currentVehicle) return;
    const layoutJson = saveLayout();
    const dataStr = JSON.stringify({
      vehicleName: currentVehicle.name,
      vehiclePlate: currentVehicle.plateNumber,
      layoutData: layoutJson,
    });
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentVehicle.name}-layout.json`;
    link.click();
  };

  const handleLoadLayout = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          loadLayout(data.layoutData);
        } catch (error) {
          console.error("Failed to load layout:", error);
          alert("Lỗi khi tải layout");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <VehicleCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🚌 Vehicle Layout Builder
            </h1>
            <p className="text-gray-600 mt-1">
              Quản lý & tùy chỉnh layout ghế xe
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              <FiPlus size={18} />
              Tạo xe mới
            </button>

            {currentVehicle && (
              <>
                <button
                  onClick={handleSaveLayout}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                >
                  <FiDownload size={18} />
                  Tải layout
                </button>
                <button
                  onClick={handleLoadLayout}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium"
                >
                  <FiUpload size={18} />
                  Tải lên
                </button>
              </>
            )}
          </div>
        </div>

        {/* Vehicle Selector */}
        {vehicles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Xe đang làm việc:</p>
            <div className="flex gap-2 flex-wrap">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => setCurrentVehicle(vehicle)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    currentVehicle?.id === vehicle.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {vehicle.name} ({vehicle.plateNumber})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {currentVehicle ? (
        <div className="flex-1 p-6 overflow-hidden">
          <div className="flex gap-6 h-full">
            {/* Left - Toolbox */}
            <Toolbox />

            {/* Center - Canvas */}
            <Canvas2D />

            {/* Right - Properties */}
            <PropertiesPanel />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-6xl mb-4">🚌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Chào mừng!
            </h2>
            <p className="text-gray-600 mb-6">Hãy tạo một xe mới để bắt đầu</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium mx-auto"
            >
              <FiPlus size={18} />
              Tạo xe mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
