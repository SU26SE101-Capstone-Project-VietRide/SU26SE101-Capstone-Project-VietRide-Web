import {
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  getFirebaseCustomToken,
  type FirebaseUploadPurpose,
} from "../api/vietride";
import { firebaseAuth, firebaseStorage } from "../config/firebase";

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const MAX_FIREBASE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const IMAGE_OPTIMIZATION_MIN_SIZE_BYTES = 512 * 1024;

type ImageOptimizationConfig = {
  maxDimension: number;
  quality: number;
};

const DEFAULT_IMAGE_OPTIMIZATION: ImageOptimizationConfig = {
  maxDimension: 1600,
  quality: 0.82,
};

const IMAGE_OPTIMIZATION_BY_PURPOSE: Partial<
  Record<FirebaseUploadPurpose, ImageOptimizationConfig>
> = {
  USER_AVATAR: { maxDimension: 640, quality: 0.82 },
  OPERATOR_LOGO: { maxDimension: 1024, quality: 0.86 },
  VEHICLE_IMAGE: { maxDimension: 1600, quality: 0.82 },
};

export type FirebaseImageErrorCode =
  | "INVALID_TYPE"
  | "INVALID_SIZE"
  | "MISSING_TOKEN"
  | "MISSING_UPLOAD_PATH";

export class FirebaseImageError extends Error {
  readonly code: FirebaseImageErrorCode;

  constructor(code: FirebaseImageErrorCode) {
    super(code);
    this.name = "FirebaseImageError";
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

export function validateFirebaseImageFile(file: File) {
  if (!isAllowedImageType(file.type)) {
    throw new FirebaseImageError("INVALID_TYPE");
  }

  if (file.size <= 0 || file.size >= MAX_FIREBASE_IMAGE_SIZE_BYTES) {
    throw new FirebaseImageError("INVALID_SIZE");
  }
}

async function optimizeImageForUpload(
  purpose: FirebaseUploadPurpose,
  file: File,
): Promise<File> {
  if (
    file.size < IMAGE_OPTIMIZATION_MIN_SIZE_BYTES ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const config =
        IMAGE_OPTIMIZATION_BY_PURPOSE[purpose] ?? DEFAULT_IMAGE_OPTIMIZATION;
      const scale = Math.min(
        1,
        config.maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");

      if (!context) {
        return file;
      }

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const optimizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", config.quality);
      });

      if (!optimizedBlob || optimizedBlob.size >= file.size) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      return new File([optimizedBlob], `${baseName}.webp`, {
        type: "image/webp",
        lastModified: file.lastModified,
      });
    } finally {
      bitmap.close();
    }
  } catch {
    // Browser decoding/Canvas support must not block a valid original upload.
    return file;
  }
}

export async function uploadFirebaseImages(
  purpose: FirebaseUploadPurpose,
  files: File[],
) {
  if (files.length === 0) {
    return [];
  }

  files.forEach(validateFirebaseImageFile);

  const { token, uploadPath } = await getFirebaseCustomToken(purpose);
  if (!token?.trim()) {
    throw new FirebaseImageError("MISSING_TOKEN");
  }
  if (!uploadPath?.trim()) {
    throw new FirebaseImageError("MISSING_UPLOAD_PATH");
  }

  await setPersistence(firebaseAuth, inMemoryPersistence);

  try {
    await signInWithCustomToken(firebaseAuth, token);
    const optimizedFiles: File[] = [];
    for (const file of files) {
      optimizedFiles.push(await optimizeImageForUpload(purpose, file));
    }

    return await Promise.all(
      optimizedFiles.map(async (file) => {
        if (!isAllowedImageType(file.type)) {
          throw new FirebaseImageError("INVALID_TYPE");
        }

        const extension = IMAGE_EXTENSION_BY_MIME[file.type];
        const imageRef = ref(
          firebaseStorage,
          `${uploadPath}${crypto.randomUUID()}.${extension}`,
        );
        const snapshot = await uploadBytes(imageRef, file, {
          contentType: file.type,
        });
        return getDownloadURL(snapshot.ref);
      }),
    );
  } finally {
    await signOut(firebaseAuth).catch(() => undefined);
  }
}
