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
});
