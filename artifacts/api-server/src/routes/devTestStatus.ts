import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

interface AssertionResult {
  ancestorTitles: string[];
  title: string;
  fullName: string;
  status: string;
  duration: number | null;
  failureMessages: string[];
}

interface TestFileResult {
  name: string;
  status: string;
  assertionResults: AssertionResult[];
  message?: string;
}

interface VitestJsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  success: boolean;
  testResults: TestFileResult[];
}

interface CoverageSummaryTotal {
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

interface CoverageSummaryFile {
  total: CoverageSummaryTotal;
  [file: string]: CoverageSummaryTotal | unknown;
}

/**
 * Groups a service's test files into product features by directory/file
 * name, so the dashboard can show pass/fail per feature area rather than
 * per raw file. Falls back to the file's base name for anything unmapped.
 */
const FEATURE_LABELS: Record<string, string> = {
  "auth.test.ts": "Auth & RBAC",
  "resume.test.ts": "Résumé versions",
  "projects.test.ts": "Portfolio",
  "booking.test.ts": "Booking (api-server proxy)",
  "availability.test.ts": "Availability",
  "appointments.test.ts": "Appointments & email",
  "scheduler.test.ts": "Reminders (scheduler)",
  "notify.test.ts": "Notifications (email dispatch)",
  "notifications.test.ts": "Notifications inbox",
  "apiKey.test.ts": "Internal API key auth",
};

function featureLabelFor(filePath: string): string {
  const base = path.basename(filePath);
  return FEATURE_LABELS[base] ?? base;
}

function readJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function summarizeService(serviceName: string, resultsPath: string, coveragePath: string) {
  const report = readJson<VitestJsonReport>(resultsPath);
  const coverage = readJson<CoverageSummaryFile>(coveragePath);

  if (!report) {
    return {
      service: serviceName,
      available: false,
      error: `No test results found at ${resultsPath}. Run the service's tests first.`,
      features: [],
      totals: { total: 0, passed: 0, failed: 0, pending: 0 },
      coverage: null,
    };
  }

  const featureMap = new Map<
    string,
    { name: string; status: "passed" | "failed"; total: number; passed: number; failed: number; tests: Array<{
      name: string;
      status: string;
      durationMs: number | null;
      failureMessages: string[];
    }> }
  >();

  for (const file of report.testResults) {
    const label = featureLabelFor(file.name);
    if (!featureMap.has(label)) {
      featureMap.set(label, { name: label, status: "passed", total: 0, passed: 0, failed: 0, tests: [] });
    }
    const feature = featureMap.get(label)!;

    if (file.assertionResults.length === 0 && file.status === "failed") {
      // The file itself failed to run (e.g. import/setup error) before any test executed.
      feature.total += 1;
      feature.failed += 1;
      feature.status = "failed";
      feature.tests.push({
        name: path.basename(file.name),
        status: "failed",
        durationMs: null,
        failureMessages: file.message ? [file.message] : ["Test file failed to run"],
      });
      continue;
    }

    for (const assertion of file.assertionResults) {
      feature.total += 1;
      if (assertion.status === "passed") {
        feature.passed += 1;
      } else if (assertion.status === "failed") {
        feature.failed += 1;
        feature.status = "failed";
      }
      feature.tests.push({
        name: [...assertion.ancestorTitles, assertion.title].join(" › "),
        status: assertion.status,
        durationMs: assertion.duration,
        failureMessages: assertion.failureMessages,
      });
    }
  }

  const features = Array.from(featureMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    service: serviceName,
    available: true,
    error: null,
    features,
    totals: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      pending: report.numPendingTests,
    },
    coverage: coverage
      ? {
          lines: coverage.total.lines.pct,
          statements: coverage.total.statements.pct,
          functions: coverage.total.functions.pct,
          branches: coverage.total.branches.pct,
        }
      : null,
    ranAt: report.startTime,
  };
}

// Internal dev tooling: exposes test names, statuses, failure messages and
// coverage percentages for both services. Gated to admins since failure
// messages can include stack traces / internal paths.
router.get("/dev/test-status", requireRole("admin"), (_req, res): void => {
  const apiServerRoot = process.cwd();
  const bookingServiceRoot = path.resolve(apiServerRoot, "..", "booking-service");

  const apiServer = summarizeService(
    "api-server",
    path.join(apiServerRoot, "test-results", "results.json"),
    path.join(apiServerRoot, "coverage", "coverage-summary.json"),
  );
  const bookingService = summarizeService(
    "booking-service",
    path.join(bookingServiceRoot, "test-results", "results.json"),
    path.join(bookingServiceRoot, "coverage", "coverage-summary.json"),
  );

  res.json({ services: [apiServer, bookingService] });
});

export default router;
