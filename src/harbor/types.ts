// Subset of the Harbor v2.0 API models used by this extension.
// Source: https://github.com/goharbor/harbor/blob/main/api/v2.0/swagger.yaml (definitions section).

export interface HarborCredentials {
  username: string;
  /** Password, OIDC CLI secret or robot account secret. */
  password: string;
}

export interface HarborProjectMetadata {
  /** "true" or "false" — the API returns booleans as strings here. */
  public?: string;
}

export interface HarborProject {
  project_id: number;
  name: string;
  repo_count?: number;
  /** Set when the project is a proxy cache of another registry. */
  registry_id?: number | null;
  metadata?: HarborProjectMetadata;
}

export interface HarborRepository {
  id: number;
  project_id: number;
  /** Full name including the project, e.g. "library/nginx" or "team/apps/api". */
  name: string;
  description?: string;
  artifact_count?: number;
  pull_count?: number;
  update_time?: string;
}

export interface HarborTag {
  id: number;
  name: string;
  push_time: string;
  pull_time?: string;
  immutable?: boolean;
}

export interface HarborArtifact {
  id: number;
  /** e.g. "IMAGE", "CHART", "CNAB". */
  type: string;
  media_type?: string;
  digest: string;
  size: number;
  push_time: string;
  pull_time?: string;
  tags: HarborTag[] | null;
  /** Requested with `with_scan_overview=true`; keyed by report MIME type. */
  scan_overview?: Record<string, HarborScanSummary> | null;
}

// Vulnerability scanning models (src/pkg/scan/vuln in goharbor/harbor).

export interface HarborScanner {
  name?: string;
  vendor?: string;
  version?: string;
}

export interface HarborVulnerabilitySummary {
  total?: number;
  fixable?: number;
  /** Count per severity, e.g. { "Critical": 2, "High": 5 }. */
  summary?: Record<string, number> | null;
}

/** NativeReportSummary: scan status and severity totals of an artifact. */
export interface HarborScanSummary {
  report_id?: string;
  /** "Pending", "Scheduled", "Running", "Stopped", "Error" or "Success". */
  scan_status?: string;
  /** "None", "Unknown", "Negligible", "Low", "Medium", "High" or "Critical". */
  severity?: string;
  summary?: HarborVulnerabilitySummary | null;
  end_time?: string;
  complete_percent?: number;
  scanner?: HarborScanner | null;
}

export interface HarborVulnerability {
  id: string;
  package?: string;
  version?: string;
  fix_version?: string;
  severity?: string;
  description?: string;
  links?: string[] | null;
  preferred_cvss?: { score_v3?: number | null; score_v2?: number | null } | null;
}

export interface HarborVulnerabilityReport {
  generated_at?: string;
  scanner?: HarborScanner | null;
  severity?: string;
  vulnerabilities?: HarborVulnerability[] | null;
}

export interface HarborSystemInfo {
  auth_mode?: string;
  /** Set when auth_mode is "oidc_auth". */
  oidc_provider_name?: string;
  // The fields below are only returned to authenticated requests.
  harbor_version?: string;
  /** Host (and port) against which docker/helm commands should be issued. */
  registry_url?: string;
  external_url?: string;
  read_only?: boolean;
}

export interface HarborErrorPayload {
  errors?: { code?: string; message?: string }[];
}
