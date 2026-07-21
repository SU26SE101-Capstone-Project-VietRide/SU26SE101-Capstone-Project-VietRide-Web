import {
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseCustomToken } from "../../../api/vietride";
import {
  firebaseAuth,
  firebaseStorage,
} from "../../../config/firebase";

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const MAX_VEHICLE_IMAGES = 5;
export const MAX_VEHICLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type VehicleImageErrorCode =
  | "INVALID_TYPE"
  | "INVALID_SIZE"
  | "MISSING_OPERATOR_ID"
  | "MISSING_TOKEN"
  | "TOO_MANY_IMAGES";

export class VehicleImageError extends Error {
  readonly code: VehicleImageErrorCode;

  constructor(code: VehicleImageErrorCode) {
    super(code);
    this.name = "VehicleImageError";
    this.code = code;
  }
}

function isAllowedImageType(
  mimeType: string,
): mimeType is keyof typeof IMAGE_EXTENSION_BY_MIME {
  return Object.prototype.hasOwnProperty.call(
    IMAGE_EXTENSION_BY_MIME,
    mimeType,
  );
}

export function validateVehicleImageFiles(
  files: File[],
  existingImageCount = 0,
) {
  if (existingImageCount + files.length > MAX_VEHICLE_IMAGES) {
    throw new VehicleImageError("TOO_MANY_IMAGES");
  }

  files.forEach((file) => {
    if (!isAllowedImageType(file.type)) {
      throw new VehicleImageError("INVALID_TYPE");
    }

    if (file.size <= 0 || file.size >= MAX_VEHICLE_IMAGE_SIZE_BYTES) {
      throw new VehicleImageError("INVALID_SIZE");
    }
  });
}

export async function uploadVehicleImages(
  operatorId: string,
  files: File[],
) {
  const normalizedOperatorId = operatorId.trim();

  if (!normalizedOperatorId) {
    throw new VehicleImageError("MISSING_OPERATOR_ID");
  }

  if (files.length === 0) {
    return [];
  }

  validateVehicleImageFiles(files);

  const { token } = await getFirebaseCustomToken();
  if (!token?.trim()) {
    throw new VehicleImageError("MISSING_TOKEN");
  }

  await setPersistence(firebaseAuth, inMemoryPersistence);

  try {
    await signInWithCustomToken(firebaseAuth, token);

    const imageUrls: string[] = [];

    for (const file of files) {
      if (!isAllowedImageType(file.type)) {
        throw new VehicleImageError("INVALID_TYPE");
      }
      const extension = IMAGE_EXTENSION_BY_MIME[file.type];
      const imageRef = ref(
        firebaseStorage,
        `vehicles/${normalizedOperatorId}/${crypto.randomUUID()}.${extension}`,
      );
      const snapshot = await uploadBytes(imageRef, file, {
        contentType: file.type,
      });

      imageUrls.push(await getDownloadURL(snapshot.ref));
    }

    return imageUrls;
  } finally {
    await signOut(firebaseAuth).catch(() => undefined);
  }
}
