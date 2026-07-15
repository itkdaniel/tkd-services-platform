import { vi } from "vitest";

/**
 * Shared manual mock for the admin résumé-upload notification, used by route
 * tests so they never make a real outbound Gmail connector call.
 */
export const notifyAdminOfResumeUpload = vi.fn(async () => {});
