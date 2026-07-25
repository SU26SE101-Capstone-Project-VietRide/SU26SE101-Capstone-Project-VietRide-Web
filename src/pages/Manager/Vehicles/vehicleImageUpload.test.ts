import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadFirebaseImages: vi.fn(),
}));

vi.mock("../../../utils/firebaseImageUpload", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("../../../utils/firebaseImageUpload")
  >();
  return {
    ...original,
    uploadFirebaseImages: mocks.uploadFirebaseImages,
  };
});

import {
  MAX_VEHICLE_IMAGE_SIZE_BYTES,
  uploadVehicleImages,
  validateVehicleImageFiles,
  VehicleImageError,
} from "./vehicleImageUpload";

describe("vehicleImageUpload", () => {
  it("uploads vehicle images with the required Firebase purpose", async () => {
    const file = new File(["vehicle"], "vehicle.jpg", {
      type: "image/jpeg",
    });
    mocks.uploadFirebaseImages.mockResolvedValue([
      "https://firebasestorage.googleapis.com/vehicle.jpg",
    ]);

    await expect(uploadVehicleImages("operator-1", [file])).resolves.toEqual([
      "https://firebasestorage.googleapis.com/vehicle.jpg",
    ]);
    expect(mocks.uploadFirebaseImages).toHaveBeenCalledWith(
      "VEHICLE_IMAGE",
      [file],
    );
  });

  it("rejects unsupported, empty, exact-5-MiB, and excess files", () => {
    const unsupported = new File(["image"], "vehicle.gif", {
      type: "image/gif",
    });
    const empty = new File([], "empty.png", { type: "image/png" });
    const exactLimit = new File(
      [new Uint8Array(MAX_VEHICLE_IMAGE_SIZE_BYTES)],
      "large.webp",
      { type: "image/webp" },
    );
    const valid = new File(["image"], "vehicle.png", {
      type: "image/png",
    });

    expect(() => validateVehicleImageFiles([unsupported])).toThrow(
      new VehicleImageError("INVALID_TYPE"),
    );
    expect(() => validateVehicleImageFiles([empty])).toThrow(
      new VehicleImageError("INVALID_SIZE"),
    );
    expect(() => validateVehicleImageFiles([exactLimit])).toThrow(
      new VehicleImageError("INVALID_SIZE"),
    );
    expect(() => validateVehicleImageFiles([valid], 5)).toThrow(
      new VehicleImageError("TOO_MANY_IMAGES"),
    );
  });
});
