import { useState } from "react";
import { FiImage } from "react-icons/fi";

type ImageStatus = "loading" | "loaded" | "error";

type ImageState = {
  src: string;
  status: ImageStatus;
};

type VehicleImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  containerClassName: string;
  loadingLabel: string;
  errorLabel: string;
  loading?: "eager" | "lazy";
};

export function VehicleImage({
  src,
  alt,
  width,
  height,
  containerClassName,
  loadingLabel,
  errorLabel,
  loading = "lazy",
}: VehicleImageProps) {
  const [imageState, setImageState] = useState<ImageState>({
    src,
    status: "loading",
  });
  const status = imageState.src === src ? imageState.status : "loading";

  return (
    <div
      className={`relative isolate overflow-hidden bg-gray-100 ${containerClassName}`}
    >
      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-vr-500"
            aria-hidden="true"
          />
          <span className="sr-only">{loadingLabel}</span>
        </div>
      )}

      {status === "error" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100 text-gray-400"
          role="img"
          aria-label={errorLabel}
        >
          <FiImage className="h-5 w-5" aria-hidden="true" />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={() => setImageState({ src, status: "loaded" })}
        onError={() => setImageState({ src, status: "error" })}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
