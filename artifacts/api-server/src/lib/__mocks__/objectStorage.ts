import { vi } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Shared manual mock for ObjectStorageService, used by route tests that
 * exercise upload/delete flows without touching real Google Cloud Storage.
 * Import `__mockFiles` to control what `getObjectEntityFile` returns.
 */
export const __mockFiles = new Map<string, { download: () => Promise<[Buffer]>; delete: () => Promise<void>; getMetadata?: () => Promise<[Record<string, unknown>]> }>();

/** Lets tests control what getTotalSizeUnderPrefix reports for a given prefix, keyed by exact prefix string. */
export const __mockPrefixSizes = new Map<string, number>();

/** Controls whether canAccessObjectEntity returns true or false (default true for convenience). */
export let __mockCanAccess = true;
export function __setMockCanAccess(value: boolean) { __mockCanAccess = value; }

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  trySetObjectEntityAclPolicy = vi.fn(async (rawPath: string) => rawPath);
  writeObjectEntity = vi.fn(async (entityId: string) => `/objects/${entityId}`);
  deleteObjectsUnderPrefix = vi.fn(async () => {});
  listObjectEntitiesUnderPrefix = vi.fn(async () => [] as Array<{ objectPath: string; file: unknown; timeCreated: Date }>);
  getTotalSizeUnderPrefix = vi.fn(async (prefix: string) => __mockPrefixSizes.get(prefix) ?? 0);
  getObjectEntityFile = vi.fn(async (objectPath: string) => {
    const file = __mockFiles.get(objectPath);
    if (!file) {
      const err = new ObjectNotFoundError();
      throw err;
    }
    return file;
  });
  getObjectEntityUploadURL = vi.fn(async () => {
    const uuid = randomUUID();
    return `https://storage.googleapis.com/test-bucket/uploads/${uuid}`;
  });
  normalizeObjectEntityPath = vi.fn((rawPath: string) => {
    // Simulate: turn a GCS URL into /objects/uploads/<uuid>
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(rawPath);
      const parts = url.pathname.split("/");
      const uploadsIdx = parts.indexOf("uploads");
      if (uploadsIdx !== -1) {
        return `/objects/uploads/${parts.slice(uploadsIdx + 1).join("/")}`;
      }
    }
    return rawPath;
  });
  canAccessObjectEntity = vi.fn(async () => __mockCanAccess);
  downloadObject = vi.fn(async (file: { download: () => Promise<[Buffer]> }) => {
    const [data] = await file.download();
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  });
}

export const UPLOAD_INTENT_TTL_MS = 60 * 60 * 1000;
