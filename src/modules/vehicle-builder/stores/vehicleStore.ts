import { create } from "zustand";
import type { Vehicle, Seat, VehicleType, DragState } from "../types";

interface VehicleStoreState {
  currentVehicle: Vehicle | null;
  selectedSeatId: string | null;
  dragState: DragState;
  vehicles: Vehicle[];

  // Vehicle actions
  setCurrentVehicle: (vehicle: Vehicle) => void;
  createNewVehicle: (
    name: string,
    plateNumber: string,
    type: VehicleType,
    model: string,
  ) => void;

  // Seat actions
  addSeat: (seat: Seat) => void;
  updateSeat: (id: string, updates: Partial<Seat>) => void;
  removeSeat: (id: string) => void;
  selectSeat: (id: string | null) => void;

  // Drag actions
  startDrag: (seatId: string, offsetX: number, offsetY: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;

  // Batch operations
  generateDefaultLayout: (rows: number, cols: number) => void;
  clearLayout: () => void;
  saveLayout: () => string; // Returns JSON
  loadLayout: (json: string) => void;

  // Vehicle list
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
}

export const useVehicleStore = create<VehicleStoreState>((set, get) => ({
  currentVehicle: null,
  selectedSeatId: null,
  dragState: {
    isDragging: false,
    draggedSeatId: null,
    offsetX: 0,
    offsetY: 0,
  },
  vehicles: [],

  setCurrentVehicle: (vehicle) => set({ currentVehicle: vehicle }),

  createNewVehicle: (name, plateNumber, type, model) => {
    const newVehicle: Vehicle = {
      id: `vehicle_${Date.now()}`,
      name,
      plateNumber,
      type,
      model,
      seats: [],
      rows: 0,
      cols: 0,
      totalCapacity: 0,
    };
    set({ currentVehicle: newVehicle });
  },

  addSeat: (seat) => {
    const { currentVehicle } = get();
    if (!currentVehicle) return;

    const updatedVehicle = {
      ...currentVehicle,
      seats: [...currentVehicle.seats, seat],
      totalCapacity: currentVehicle.seats.length + 1,
    };
    set({ currentVehicle: updatedVehicle });
  },

  updateSeat: (id, updates) => {
    const { currentVehicle } = get();
    if (!currentVehicle) return;

    const updatedVehicle = {
      ...currentVehicle,
      seats: currentVehicle.seats.map((seat) =>
        seat.id === id ? { ...seat, ...updates } : seat,
      ),
    };
    set({ currentVehicle: updatedVehicle });
  },

  removeSeat: (id) => {
    const { currentVehicle, selectedSeatId } = get();
    if (!currentVehicle) return;

    const updatedVehicle = {
      ...currentVehicle,
      seats: currentVehicle.seats.filter((seat) => seat.id !== id),
      totalCapacity: currentVehicle.seats.length - 1,
    };

    const newSelectedId = selectedSeatId === id ? null : selectedSeatId;
    set({
      currentVehicle: updatedVehicle,
      selectedSeatId: newSelectedId,
    });
  },

  selectSeat: (id) => set({ selectedSeatId: id }),

  startDrag: (seatId, offsetX, offsetY) => {
    set({
      dragState: {
        isDragging: true,
        draggedSeatId: seatId,
        offsetX,
        offsetY,
      },
    });
  },

  updateDrag: (x, y) => {
    const { currentVehicle, dragState } = get();
    if (!dragState.isDragging || !dragState.draggedSeatId || !currentVehicle)
      return;

    const newX = x - dragState.offsetX;
    const newY = y - dragState.offsetY;

    get().updateSeat(dragState.draggedSeatId, {
      x: newX,
      y: newY,
    });
  },

  endDrag: () => {
    set({
      dragState: {
        isDragging: false,
        draggedSeatId: null,
        offsetX: 0,
        offsetY: 0,
      },
    });
  },

  generateDefaultLayout: (rows, cols) => {
    const { currentVehicle } = get();
    if (!currentVehicle) return;

    const newSeats: Seat[] = [];
    const seatWidth = 60;
    const seatHeight = 60;
    const spacingX = 80;
    const spacingY = 80;
    const startX = 50;
    const startY = 50;

    let seatCounter = 1;
    const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seat: Seat = {
          id: `seat_${r}_${c}`,
          type: "NORMAL",
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          rotation: 0,
          label: `${labels[c]}${String(r + 1).padStart(2, "0")}`,
          enabled: true,
          color: "#3B82F6",
          width: seatWidth,
          height: seatHeight,
        };
        newSeats.push(seat);
        seatCounter++;
      }
    }

    const updatedVehicle = {
      ...currentVehicle,
      seats: newSeats,
      rows,
      cols,
      totalCapacity: rows * cols,
    };
    set({ currentVehicle: updatedVehicle });
  },

  clearLayout: () => {
    const { currentVehicle } = get();
    if (!currentVehicle) return;

    set({
      currentVehicle: {
        ...currentVehicle,
        seats: [],
        totalCapacity: 0,
      },
    });
  },

  saveLayout: () => {
    const { currentVehicle } = get();
    if (!currentVehicle) return "{}";

    const layout = {
      vehicleType: currentVehicle.type,
      model: currentVehicle.model,
      seats: currentVehicle.seats.map((seat) => ({
        id: seat.id,
        type: seat.type,
        x: seat.x,
        y: seat.y,
        rotation: seat.rotation,
        label: seat.label,
        color: seat.color,
      })),
    };

    return JSON.stringify(layout);
  },

  loadLayout: (json) => {
    try {
      const layout = JSON.parse(json);
      const { currentVehicle } = get();
      if (!currentVehicle) return;

      const seats: Seat[] = layout.seats.map((s: any) => ({
        ...s,
        width: 60,
        height: 60,
        enabled: true,
      }));

      set({
        currentVehicle: {
          ...currentVehicle,
          type: layout.vehicleType,
          model: layout.model,
          seats,
          totalCapacity: seats.length,
        },
      });
    } catch (error) {
      console.error("Failed to load layout:", error);
    }
  },

  addVehicle: (vehicle) => {
    const { vehicles } = get();
    set({ vehicles: [...vehicles, vehicle] });
  },

  updateVehicle: (id, updates) => {
    const { vehicles } = get();
    set({
      vehicles: vehicles.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    });
  },

  deleteVehicle: (id) => {
    const { vehicles, currentVehicle } = get();
    const newVehicles = vehicles.filter((v) => v.id !== id);
    const newCurrentVehicle = currentVehicle?.id === id ? null : currentVehicle;
    set({
      vehicles: newVehicles,
      currentVehicle: newCurrentVehicle,
    });
  },
}));
