import {
  FirebaseImageError,
  MAX_FIREBASE_IMAGE_SIZE_BYTES,
  uploadFirebaseImages,
  validateFirebaseImageFile,
} from "../../../utils/firebaseImageUpload";

export const MAX_VEHICLE_IMAGES = 5;
export const MAX_VEHICLE_IMAGE_SIZE_BYTES = MAX_FIREBASE_IMAGE_SIZE_BYTES;

export type VehicleImageErrorCode =
  | "INVALID_TYPE"
  | "INVALID_SIZE"
  | "MISSING_OPERATOR_ID"
  | "MISSING_TOKEN"
  | "MISSING_UPLOAD_PATH"
  | "TOO_MANY_IMAGES";

export class VehicleImageError extends Error {
  readonly code: VehicleImageErrorCode;

  constructor(code: VehicleImageErrorCode) {
    super(code);
    this.name = "VehicleImageError";
    this.code = code;
  }
}

export function validateVehicleImageFiles(
  files: File[],
  existingImageCount = 0,
) {
  if (existingImageCount + files.length > MAX_VEHICLE_IMAGES) {
    throw new VehicleImageError("TOO_MANY_IMAGES");
  }

  files.forEach((file) => {
    try {
      validateFirebaseImageFile(file);
    } catch (error) {
      if (error instanceof FirebaseImageError) {
        throw new VehicleImageError(error.code);
      }
      throw error;
    }
  });
}

export async function uploadVehicleImages(
  operatorId: string,
  files: File[],
) {
  if (!operatorId.trim()) {
    throw new VehicleImageError("MISSING_OPERATOR_ID");
  }

  if (files.length === 0) {
    return [];
  }

  validateVehicleImageFiles(files);

  try {
    return await uploadFirebaseImages("VEHICLE_IMAGE", files);
  } catch (error) {
    if (error instanceof FirebaseImageError) {
      throw new VehicleImageError(error.code);
    }
    throw error;
  }
}
