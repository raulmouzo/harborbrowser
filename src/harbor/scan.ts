import { HarborArtifact, HarborScanSummary } from "./types";

/**
 * Report formats accepted from the scanner, in order of preference. Same value
 * the Harbor portal sends in the X-Accept-Vulnerabilities header.
 */
export const VULNERABILITY_REPORT_MIME_TYPES =
  "application/vnd.security.vulnerability.report; version=1.1, application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0";

/** Severities reported by Harbor, from most to least severe. */
export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Negligible", "Unknown", "None"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type ScanState =
  | { kind: "notScanned" }
  | { kind: "queued" }
  | { kind: "running"; percent?: number }
  | { kind: "stopped" }
  | { kind: "failed" }
  | { kind: "other"; status: string }
  | { kind: "done"; severity: Severity; summary: HarborScanSummary };

/** Vulnerability scan state of an artifact, from its `scan_overview`. */
export function scanState(artifact: HarborArtifact): ScanState {
  const summary = Object.values(artifact.scan_overview ?? {})[0];
  if (!summary?.scan_status) {
    return { kind: "notScanned" };
  }
  switch (summary.scan_status) {
    case "Pending":
    case "Scheduled":
      return { kind: "queued" };
    case "Running":
      return { kind: "running", percent: summary.complete_percent };
    case "Stopped":
      return { kind: "stopped" };
    case "Error":
      return { kind: "failed" };
    case "Success":
      return { kind: "done", severity: toSeverity(summary.severity), summary };
    default:
      return { kind: "other", status: summary.scan_status };
  }
}

/** Short text for tree item descriptions; undefined when there is nothing to flag. */
export function scanDescription(state: ScanState): string | undefined {
  switch (state.kind) {
    case "queued":
      return "scan queued";
    case "running":
      return state.percent ? `scanning ${state.percent}%` : "scanning";
    case "stopped":
      return "scan stopped";
    case "failed":
      return "scan failed";
    case "other":
      return `scan ${state.status.toLowerCase()}`;
    case "done": {
      const total = state.summary.summary?.total ?? 0;
      if (state.severity === "None" || total === 0) {
        return undefined;
      }
      return `${state.severity.toLowerCase()} (${total})`;
    }
    default:
      return undefined;
  }
}

/** One-line summary such as "2 critical, 5 high, 1 low — 4 fixable". */
export function vulnerabilityCounts(summary: HarborScanSummary): string {
  const total = summary.summary?.total ?? 0;
  if (total === 0) {
    return "No vulnerabilities found";
  }
  const bySeverity = summary.summary?.summary ?? {};
  const counts = SEVERITIES
    .filter((severity) => (bySeverity[severity] ?? 0) > 0)
    .map((severity) => `${bySeverity[severity]} ${severity.toLowerCase()}`);
  const fixable = summary.summary?.fixable;
  return `${counts.length > 0 ? counts.join(", ") : `${total} total`}${fixable ? ` — ${fixable} fixable` : ""}`;
}

export function toSeverity(value: string | undefined): Severity {
  return SEVERITIES.find((severity) => severity === value) ?? "Unknown";
}
