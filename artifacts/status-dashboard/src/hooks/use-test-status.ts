import { useQuery } from '@tanstack/react-query';

export type TestResult = {
  name: string;
  status: "passed" | "failed";
  durationMs: number;
  failureMessages: string[];
};

export type FeatureResult = {
  name: string;
  status: "passed" | "failed";
  total: number;
  passed: number;
  failed: number;
  tests: TestResult[];
};

export type CoverageResult = {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
};

export type ServiceResult = {
  service: "api-server" | "booking-service";
  available: boolean;
  error: string | null;
  features: FeatureResult[];
  coverage: CoverageResult | null;
};

export type TestStatusResponse = {
  services: ServiceResult[];
};

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function useTestStatus() {
  return useQuery<TestStatusResponse, Error>({
    queryKey: ['test-status'],
    queryFn: async () => {
      // The api-server owns "/api" globally (not nested under this artifact's
      // own base path), so this must be a root-relative fetch, not prefixed
      // with import.meta.env.BASE_URL.
      const response = await fetch(`/api/dev/test-status`, {
        credentials: "include"
      });

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedError();
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch test status: ${response.statusText}`);
      }

      return response.json();
    },
    refetchInterval: 15000,
    retry: (failureCount, err) => !(err instanceof UnauthorizedError) && failureCount < 2,
  });
}
