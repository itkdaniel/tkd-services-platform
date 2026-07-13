import { useCallback, useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";

export interface UploadedFileMeta {
  objectPath: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface DirectUploadResult {
  upload: (file: File) => Promise<UploadedFileMeta>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

/**
 * Generic two-step direct-to-object-storage upload: request a presigned URL,
 * PUT the file to it, and hand back the resulting object metadata. Callers
 * are responsible for confirming the upload against whichever endpoint owns
 * that resource (e.g. creating/updating a project, registering a sub-app).
 */
export function useDirectUpload(): DirectUploadResult {
  const requestUploadUrl = useRequestUploadUrl();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadedFileMeta> => {
      setError(null);
      setProgress(0);
      setIsUploading(true);
      try {
        const contentType = file.type || "application/octet-stream";
        const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType },
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadURL);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        setProgress(100);
        return { objectPath, filename: file.name, contentType, sizeBytes: file.size };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl],
  );

  return { upload, isUploading, progress, error, reset };
}
