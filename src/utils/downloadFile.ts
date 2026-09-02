import type { ApiFileResponse } from "../api/client";

export function downloadFile(
  response: ApiFileResponse,
  fallbackFileName: string,
) {
  const objectUrl = URL.createObjectURL(response.blob);
  const link = document.createElement("a");
  const serverFileName = response.fileName?.split(/[\\/]/).pop();

  link.href = objectUrl;
  link.download = serverFileName || fallbackFileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
