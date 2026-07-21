import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDownloadURL: vi.fn(),
  getFirebaseCustomToken: vi.fn(),
  ref: vi.fn(),
  setPersistence: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  inMemoryPersistence: { type: "NONE" },
  setPersistence: mocks.setPersistence,
  signInWithCustomToken: mocks.signInWithCustomToken,
  signOut: mocks.signOut,
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: mocks.getDownloadURL,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
}));

vi.mock("../../../api/vietride", () => ({
  getFirebaseCustomToken: mocks.getFirebaseCustomToken,
}));

vi.mock("../../../config/firebase", () => ({
  firebaseAuth: { currentUser: null },
  firebaseStorage: {},
}));

import {
  MAX_VEHICLE_IMAGE_SIZE_BYTES,
  uploadVehicleImages,
  validateVehicleImageFiles,
  VehicleImageError,
} from "./vehicleImageUpload";

describe("vehicleImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseCustomToken.mockResolvedValue({ token: "custom-token" });
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.signInWithCustomToken.mockResolvedValue({ user: {} });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
    mocks.uploadBytes.mockImplementation(async (imageRef: unknown) => ({
      ref: imageRef,
    }));
    mocks.getDownloadURL.mockResolvedValue(
      "https://firebasestorage.googleapis.com/vehicle.jpg",
    );
  });

  it("uploads an allowed image and signs out of Firebase", async () => {
    const file = new File(["vehicle"], "vehicle.jpg", {
      type: "image/jpeg",
    });

    await expect(uploadVehicleImages("operator-1", [file])).resolves.toEqual([
      "https://firebasestorage.googleapis.com/vehicle.jpg",
    ]);

    expect(mocks.setPersistence).toHaveBeenCalledOnce();
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith(
      { currentUser: null },
      "custom-token",
    );
    expect(mocks.ref).toHaveBeenCalledWith(
      {},
      expect.stringMatching(/^vehicles\/operator-1\/[0-9a-f-]+\.jpg$/),
    );
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.anything(),
      file,
      { contentType: "image/jpeg" },
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
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
