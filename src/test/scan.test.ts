import * as assert from "assert";
import { scanDescription, scanState, toSeverity, vulnerabilityCounts } from "../harbor/scan";
import { HarborArtifact, HarborScanSummary } from "../harbor/types";

const MIME = "application/vnd.security.vulnerability.report; version=1.1";

function artifact(summary?: HarborScanSummary): HarborArtifact {
  return {
    id: 1, type: "IMAGE", digest: "sha256:aa", size: 1, push_time: "2026-01-01T00:00:00Z", tags: null,
    scan_overview: summary ? { [MIME]: summary } : undefined,
  };
}

suite("scan", () => {
  test("maps Harbor scan statuses", () => {
    assert.deepStrictEqual(scanState(artifact()), { kind: "notScanned" });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Pending" })), { kind: "queued" });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Scheduled" })), { kind: "queued" });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Running", complete_percent: 40 })), { kind: "running", percent: 40 });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Stopped" })), { kind: "stopped" });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Error" })), { kind: "failed" });
    assert.deepStrictEqual(scanState(artifact({ scan_status: "Paused" })), { kind: "other", status: "Paused" });
    const done = scanState(artifact({ scan_status: "Success", severity: "High", summary: { total: 3 } }));
    assert.strictEqual(done.kind, "done");
    assert.strictEqual(done.kind === "done" && done.severity, "High");
  });

  test("scanDescription only flags findings and unfinished scans", () => {
    assert.strictEqual(scanDescription({ kind: "notScanned" }), undefined);
    assert.strictEqual(scanDescription({ kind: "running", percent: 40 }), "scanning 40%");
    assert.strictEqual(scanDescription({ kind: "failed" }), "scan failed");
    assert.strictEqual(
      scanDescription({ kind: "done", severity: "Critical", summary: { summary: { total: 7 } } }),
      "critical (7)",
    );
    assert.strictEqual(scanDescription({ kind: "done", severity: "None", summary: { summary: { total: 0 } } }), undefined);
  });

  test("vulnerabilityCounts lists severities from most to least severe", () => {
    assert.strictEqual(
      vulnerabilityCounts({ summary: { total: 8, fixable: 4, summary: { Low: 1, Critical: 2, High: 5 } } }),
      "2 critical, 5 high, 1 low — 4 fixable",
    );
    assert.strictEqual(vulnerabilityCounts({ summary: { total: 0 } }), "No vulnerabilities found");
    assert.strictEqual(vulnerabilityCounts({ summary: { total: 3, summary: {} } }), "3 total");
  });

  test("toSeverity falls back to Unknown", () => {
    assert.strictEqual(toSeverity("Medium"), "Medium");
    assert.strictEqual(toSeverity("medium"), "Unknown");
    assert.strictEqual(toSeverity(undefined), "Unknown");
  });
});
