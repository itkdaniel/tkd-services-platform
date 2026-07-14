import { vi } from "vitest";

/**
 * Shared manual mock for ObjectStorageService, used by route tests that
 * exercise upload/delete flows without touching real Google Cloud Storage.
 * Import `__mockFiles` to control what `getObjectEntityFile` returns.
 */
export const __mockFiles = new Map<string, { download: () => Promise<[Buffer]>; delete: () => Promise<void> }>();

export class ObjectStorageService {
  trySetObjectEntityAclPolicy = vi.fn(async (rawPath: string) => rawPath);
  writeObjectEntity = vi.fn(async (entityId: string) => `/objects/${entityId}`);
  deleteObjectsUnderPrefix = vi.fn(async () => {});
  listObjectEntitiesUnderPrefix = vi.fn(async () => [] as Array<{ objectPath: string; file: unknown; timeCreated: Date }>);
  getObjectEntityFile = vi.fn(async (objectPath: string) => {
    const file = __mockFiles.get(objectPath);
    if (!file) {
      const err = new Error("Object not found");
      err.name = "ObjectNotFoundError";
      throw err;
    }
    return file;
  });
}

export const UPLOAD_INTENT_TTL_MS = 60 * 60 * 1000;
