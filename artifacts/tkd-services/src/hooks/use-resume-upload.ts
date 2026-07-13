import { useCallback, useState } from "react";
import { useRequestUploadUrl, useCreateResumeVersion } from "@workspace/api-client-react";

export interface ResumeUploadResult {
  upload: (file: File, label?: string) => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function useResumeUpload(onSuccess?: () => void): ResumeUploadResult {
  const requestUploadUrl = useRequestUploadUrl();
  const createResumeVersion = useCreateResumeVersion();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
  }, []);

  const upload = useCallback(
    async (file: File, label?: string) => {
      setError(null);
      setProgress(0);

      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError("File exceeds the 10MB size limit.");
        return;
      }

      setIsUploading(true);
      try {
        const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type },
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadURL);
          xhr.setRequestHeader("Content-Type", file.type);
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

        await createResumeVersion.mutateAsync({
          data: {
            objectPath,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            ...(label ? { label } : {}),
          },
        });

        setProgress(100);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, createResumeVersion, onSuccess],
  );

  return { upload, isUploading, progress, error, reset };
}
