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
    const imageUrls: string[] = [];

    for (const file of files) {
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
      imageUrls.push(await getDownloadURL(snapshot.ref));
    }

    return imageUrls;
  } finally {
    await signOut(firebaseAuth).catch(() => undefined);
  }
}
