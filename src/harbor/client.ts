import { HarborApiError, HarborConnectionError } from "./errors";
import {
  HarborArtifact,
  HarborCredentials,
  HarborProject,
  HarborRepository,
  HarborSystemInfo,
  HarborVulnerabilityReport,
} from "./types";
import { VULNERABILITY_REPORT_MIME_TYPES } from "./scan";
import { encodeRepositoryPathSegment } from "./url";

/** Largest page size accepted by the Harbor API. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface HarborClientOptions {
  /** Normalized origin of the Harbor instance (see normalizeRegistryUrl). */
  baseUrl: string;
  /** Omit to browse anonymously (public projects only). */
  credentials?: HarborCredentials;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface SystemInfoResult {
  info: HarborSystemInfo;
  /** Whether Harbor accepted the credentials; undefined for anonymous clients. */
  credentialsAccepted?: boolean;
}

export type ProjectVisibility = "public" | "private";

type QueryParams = Record<string, string | number | boolean>;

export class HarborClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HarborClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  /**
   * General information about the instance. The endpoint works anonymously, but
   * its protected fields (harbor_version, registry_url…) are only returned to
   * authenticated callers, which makes it the one place where credentials can be
   * verified for every kind of account:
   * - Harbor never answers wrong Basic credentials with 401 on regular endpoints;
   *   it silently treats the request as anonymous.
   * - With OIDC authentication a CLI secret is only accepted on a short list of
   *   endpoints (systeminfo, project/repository/artifact listings…), so
   *   `/users/current` cannot be used to validate it.
   */
  async getSystemInfo(): Promise<SystemInfoResult> {
    const response = await this.request("/systeminfo");
    const info = await parseJson<HarborSystemInfo>(response);
    if (typeof info?.auth_mode !== "string") {
      throw new Error(`${this.options.baseUrl} does not look like a Harbor v2 instance`);
    }
    return {
      info,
      credentialsAccepted: this.options.credentials ? info.harbor_version !== undefined : undefined,
    };
  }

  listProjects(visibility: ProjectVisibility): Promise<HarborProject[]> {
    return this.requestAllPages<HarborProject>("/projects", {
      public: visibility === "public",
      sort: "name",
    });
  }

  listRepositories(projectName: string): Promise<HarborRepository[]> {
    return this.requestAllPages<HarborRepository>(
      `/projects/${encodeURIComponent(projectName)}/repositories`,
      { sort: "name" },
    );
  }

  listArtifacts(projectName: string, repositoryShortName: string): Promise<HarborArtifact[]> {
    return this.requestAllPages<HarborArtifact>(
      artifactsPath(projectName, repositoryShortName),
      { with_tag: true, with_accessory: false, with_scan_overview: true, sort: "-push_time" },
      { "X-Accept-Vulnerabilities": VULNERABILITY_REPORT_MIME_TYPES },
    );
  }

  /**
   * Full vulnerability report of an artifact (aggregated over the child images
   * of an index). Returns undefined when no report exists yet.
   */
  async getVulnerabilityReport(
    projectName: string,
    repositoryShortName: string,
    reference: string,
  ): Promise<HarborVulnerabilityReport | undefined> {
    const response = await this.request(
      `${artifactsPath(projectName, repositoryShortName)}/${encodeURIComponent(reference)}/additions/vulnerabilities`,
      {},
      { "X-Accept-Vulnerabilities": VULNERABILITY_REPORT_MIME_TYPES },
    );
    // The body maps the report MIME type to the report, or is {} when there is none.
    const reports = (await parseJson<Record<string, HarborVulnerabilityReport> | null>(response)) ?? {};
    return Object.values(reports)[0];
  }

  /**
   * Fetches every page of a list endpoint. The `Link` header is not followed
   * because Harbor unescapes its query string; pages are requested explicitly
   * until `X-Total-Count` items are collected or a short page is returned.
   */
  private async requestAllPages<T>(
    path: string,
    query: QueryParams,
    extraHeaders: Record<string, string> = {},
  ): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const response = await this.request(path, { ...query, page, page_size: MAX_PAGE_SIZE }, extraHeaders);
      const pageItems = (await parseJson<T[] | null>(response)) ?? [];
      items.push(...pageItems);

      const total = Number(response.headers.get("X-Total-Count"));
      const reachedTotal = Number.isFinite(total) && total > 0 && items.length >= total;
      if (pageItems.length < MAX_PAGE_SIZE || reachedTotal) {
        return items;
      }
    }
  }

  private async request(
    path: string,
    query: QueryParams = {},
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const url = new URL(`/api/v2.0${path}`, this.options.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
    const requestUrl = url.toString();

    const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
    if (this.options.credentials) {
      const { username, password } = this.options.credentials;
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(requestUrl, {
        headers,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new HarborConnectionError(requestUrl, error);
    }

    if (!response.ok) {
      throw await HarborApiError.fromResponse(response, requestUrl);
    }
    return response;
  }
}

function artifactsPath(projectName: string, repositoryShortName: string): string {
  return `/projects/${encodeURIComponent(projectName)}/repositories/${encodeRepositoryPathSegment(repositoryShortName)}/artifacts`;
}

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`Unexpected response from ${response.url || "the server"}: the body is not JSON. Is this a Harbor v2 instance?`);
  }
}
