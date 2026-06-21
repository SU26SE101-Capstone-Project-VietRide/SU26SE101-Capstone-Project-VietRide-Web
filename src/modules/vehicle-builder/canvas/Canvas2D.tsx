import React, { useRef, useEffect } from "react";
import { useVehicleStore } from "../stores/vehicleStore";
import type { Seat } from "../types";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SEAT_SIZE = 50;

export const Canvas2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = 1;
  const {
    currentVehicle,
    selectedSeatId,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    selectSeat,
  } = useVehicleStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentVehicle) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= CANVAS_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= CANVAS_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    // Draw vehicle outline
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, CANVAS_WIDTH - 100, CANVAS_HEIGHT - 100);

    // Draw seats
    currentVehicle.seats.forEach((seat) => {
      const isSelected = seat.id === selectedSeatId;
      const isDragged = seat.id === dragState.draggedSeatId;

      // Seat rectangle
      ctx.fillStyle = isDragged
        ? "#fbbf24"
        : isSelected
          ? "#f59e0b"
          : seat.color || "#3b82f6";
      ctx.fillRect(
        seat.x,
        seat.y,
        seat.width || SEAT_SIZE,
        seat.height || SEAT_SIZE,
      );

      // Seat border
      ctx.strokeStyle = isSelected ? "#dc2626" : "#ffffff";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(
        seat.x,
        seat.y,
        seat.width || SEAT_SIZE,
        seat.height || SEAT_SIZE,
      );

      // Seat label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        seat.label,
        seat.x + (seat.width || SEAT_SIZE) / 2,
        seat.y + (seat.height || SEAT_SIZE) / 2,
      );
    });
  }, [currentVehicle, selectedSeatId, dragState]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentVehicle) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Find clicked seat
    let clickedSeat: Seat | null = null;
    for (const seat of currentVehicle.seats) {
      if (
        x >= seat.x &&
        x <= seat.x + (seat.width || SEAT_SIZE) &&
        y >= seat.y &&
        y <= seat.y + (seat.height || SEAT_SIZE)
      ) {
        clickedSeat = seat;
        break;
      }
    }

    if (clickedSeat) {
      selectSeat(clickedSeat.id);
      startDrag(clickedSeat.id, x - clickedSeat.x, y - clickedSeat.y);
    } else {
      selectSeat(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    updateDrag(x, y);
  };

  const handleCanvasMouseUp = () => {
    endDrag();
  };

  return (
    <div className="flex-1 bg-white rounded-lg shadow p-4">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {currentVehicle?.name || "Chọn xe"}
        </h2>
        <div className="text-sm text-gray-600">
          {currentVehicle?.totalCapacity || 0} chỗ
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        className="border border-gray-300 bg-gray-50 cursor-pointer w-full"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
};
