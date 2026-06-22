import { useVehicleStore } from "./vehicleStore";
import type { Seat } from "../types";

const initialDragState = {
  isDragging: false,
  draggedSeatId: null,
  offsetX: 0,
  offsetY: 0,
};

beforeEach(() => {
  useVehicleStore.setState({
    currentVehicle: null,
    selectedSeatId: null,
    dragState: initialDragState,
    vehicles: [],
  });
});

describe("useVehicleStore", () => {
  it("creates a vehicle and generates a default layout", () => {
    const store = useVehicleStore.getState();

    store.createNewVehicle("Sleeper Bus", "51B-12345", "SLEEPER", "MODEL_A");
    useVehicleStore.getState().generateDefaultLayout(2, 3);

    const vehicle = useVehicleStore.getState().currentVehicle;

    expect(vehicle).toMatchObject({
      name: "Sleeper Bus",
      plateNumber: "51B-12345",
      type: "SLEEPER",
      model: "MODEL_A",
      rows: 2,
      cols: 3,
      totalCapacity: 6,
    });
    expect(vehicle?.seats).toHaveLength(6);
    expect(vehicle?.seats[0]).toMatchObject({
      id: "seat_0_0",
      label: "A01",
      enabled: true,
    });
  });

  it("updates dragged seat position using the stored pointer offset", () => {
    const seat: Seat = {
      id: "seat_1",
      type: "NORMAL",
      x: 10,
      y: 20,
      rotation: 0,
      label: "A01",
      enabled: true,
      width: 60,
      height: 60,
    };

    useVehicleStore.getState().createNewVehicle("Bus", "51B-00001", "SEAT", "MODEL_A");
    useVehicleStore.getState().addSeat(seat);
    useVehicleStore.getState().startDrag("seat_1", 5, 7);
    useVehicleStore.getState().updateDrag(30, 40);

    expect(useVehicleStore.getState().currentVehicle?.seats[0]).toMatchObject({
      x: 25,
      y: 33,
    });
  });

  it("loads a saved layout into the current vehicle", () => {
    useVehicleStore.getState().createNewVehicle("Bus", "51B-00001", "SEAT", "MODEL_A");

    useVehicleStore.getState().loadLayout(
      JSON.stringify({
        vehicleType: "LIMO",
        model: "MODEL_B",
        seats: [
          {
            id: "seat_loaded",
            type: "VIP",
            x: 12,
            y: 24,
            rotation: 0,
            label: "VIP1",
            color: "#111111",
          },
        ],
      }),
    );

    const vehicle = useVehicleStore.getState().currentVehicle;

    expect(vehicle).toMatchObject({
      type: "LIMO",
      model: "MODEL_B",
      totalCapacity: 1,
    });
    expect(vehicle?.seats[0]).toMatchObject({
      id: "seat_loaded",
      width: 60,
      height: 60,
      enabled: true,
    });
  });
});
