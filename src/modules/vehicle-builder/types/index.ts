// Vehicle Types
export type VehicleType = "SEAT" | "SLEEPER" | "LIMO";

export type SeatType = "NORMAL" | "VIP" | "BED" | "DRIVER";

// Seat Interface
export interface Seat {
  id: string;
  type: SeatType;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  label: string;
  enabled: boolean;
  color?: string;
  width?: number;
  height?: number;
}

// Vehicle Interface
export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  type: VehicleType;
  model: string; // "HYUNDAI_UNIVERSE" | "THACO_MOBIHOME" | "SAMCO" | "COUNTY"
  seats: Seat[];
  rows: number;
  cols: number;
  totalCapacity: number;
  layoutJSON?: string; // JSON string for storage
}

// Vehicle Model Specs
export interface VehicleModelSpec {
  id: string;
  name: string;
  width: number;
  length: number;
  defaultRows: number;
  defaultCols: number;
}

// Layout JSON structure for storage
export interface VehicleLayout {
  vehicleType: VehicleType;
  model: string;
  seats: Array<{
    id: string;
    type: SeatType;
    x: number;
    y: number;
    rotation: number;
    label: string;
    color?: string;
  }>;
}

// Drag State
export interface DragState {
  isDragging: boolean;
  draggedSeatId: string | null;
  offsetX: number;
  offsetY: number;
}
