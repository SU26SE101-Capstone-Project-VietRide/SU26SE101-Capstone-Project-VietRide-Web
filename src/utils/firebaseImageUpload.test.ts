import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../api/vietride", () => ({
  getFirebaseCustomToken: mocks.getFirebaseCustomToken,
}));

vi.mock("../config/firebase", () => ({
  firebaseAuth: { currentUser: null },
  firebaseStorage: {},
}));

import {
  FirebaseImageError,
  MAX_FIREBASE_IMAGE_SIZE_BYTES,
  uploadFirebaseImages,
  validateFirebaseImageFile,
} from "./firebaseImageUpload";

describe("firebaseImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseCustomToken.mockResolvedValue({
      token: "custom-token",
      purpose: "USER_AVATAR",
      uploadPath: "avatars/user-1/",
    });
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.signInWithCustomToken.mockResolvedValue({ user: {} });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
    mocks.uploadBytes.mockImplementation(async (imageRef: unknown) => ({
      ref: imageRef,
    }));
    mocks.getDownloadURL.mockResolvedValue(
      "https://firebasestorage.googleapis.com/avatar.jpg",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the requested purpose and the upload path returned by BE", async () => {
    const file = new File(["avatar"], "avatar.jpg", { type: "image/jpeg" });

    await expect(uploadFirebaseImages("USER_AVATAR", [file])).resolves.toEqual([
      "https://firebasestorage.googleapis.com/avatar.jpg",
    ]);

    expect(mocks.getFirebaseCustomToken).toHaveBeenCalledWith("USER_AVATAR");
    expect(mocks.ref).toHaveBeenCalledWith(
      {},
      expect.stringMatching(/^avatars\/user-1\/[0-9a-f-]+\.jpg$/),
    );
    expect(mocks.uploadBytes).toHaveBeenCalledWith(expect.anything(), file, {
      contentType: "image/jpeg",
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects invalid image type and files at the 5 MiB limit", () => {
    const invalidType = new File(["image"], "avatar.gif", {
      type: "image/gif",
    });
    const exactLimit = new File(
      [new Uint8Array(MAX_FIREBASE_IMAGE_SIZE_BYTES)],
      "avatar.webp",
      { type: "image/webp" },
    );

    expect(() => validateFirebaseImageFile(invalidType)).toThrow(
      new FirebaseImageError("INVALID_TYPE"),
    );
    expect(() => validateFirebaseImageFile(exactLimit)).toThrow(
      new FirebaseImageError("INVALID_SIZE"),
    );
  });

  it("resizes and converts a large image before uploading", async () => {
    const file = new File(
      [new Uint8Array(600 * 1024)],
      "large-camera-photo.jpg",
      { type: "image/jpeg" },
    );
    const close = vi.fn();
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["optimized"], { type: "image/webp" }));
      }),
    } as unknown as HTMLCanvasElement;
    const createElement = document.createElement.bind(document);

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }),
    );
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : createElement(tagName),
    );

    await uploadFirebaseImages("USER_AVATAR", [file]);

    const uploadedFile = mocks.uploadBytes.mock.calls[0]?.[1];
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile).toMatchObject({
      name: "large-camera-photo.webp",
      type: "image/webp",
    });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.ref).toHaveBeenCalledWith(
      {},
      expect.stringMatching(/^avatars\/user-1\/[0-9a-f-]+\.webp$/),
    );
  });

  it("starts multiple image uploads in parallel", async () => {
    const files = [
      new File(["front"], "front.jpg", { type: "image/jpeg" }),
      new File(["back"], "back.jpg", { type: "image/jpeg" }),
    ];
    const pendingUploads: Array<() => void> = [];
    mocks.uploadBytes.mockImplementation(
      (imageRef: unknown) =>
        new Promise((resolve) => {
          pendingUploads.push(() => resolve({ ref: imageRef }));
        }),
    );

    const uploadPromise = uploadFirebaseImages("VEHICLE_IMAGE", files);

    await vi.waitFor(() => {
      expect(mocks.uploadBytes).toHaveBeenCalledTimes(2);
    });
    pendingUploads.forEach((resolve) => resolve());

    await expect(uploadPromise).resolves.toHaveLength(2);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
