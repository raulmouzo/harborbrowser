export interface HarborProject {
  project_id: number;
  name: string;
  repo_count: number;
  public: boolean;
}

export interface HarborCredentials {
  url: string;
  username: string;
  password: string;
}

export interface HarborRepository {
  name: string; // "projectname/reponame"
  artifact_count: number;
  pull_count: number;
}

export interface HarborTag {
  name: string;
  push_time: string;
}

export interface HarborArtifact {
  digest: string;
  push_time: string;
  size: number;
  tags: HarborTag[] | null;
}

function buildHeaders(credentials?: HarborCredentials): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (credentials) {
    const encoded = Buffer.from(
      `${credentials.username}:${credentials.password}`,
    ).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }
  return headers;
}

async function fetchProjects(
  baseUrl: string,
  isPublic: boolean,
  credentials?: HarborCredentials,
): Promise<HarborProject[]> {
  const requestUrl = `${baseUrl}/api/v2.0/projects?public=${isPublic}&page_size=100`;
  const response = await fetch(requestUrl, { headers: buildHeaders(credentials) });
  if (!response.ok) {
    throw new Error(`Harbor API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<HarborProject[]>;
}

export async function listPublicProjects(
  baseUrl: string,
): Promise<HarborProject[]> {
  return fetchProjects(baseUrl, true);
}

export async function listPrivateProjects(
  credentials: HarborCredentials,
): Promise<HarborProject[]> {
  return fetchProjects(credentials.url, false, credentials);
}

export async function listRepositories(
  baseUrl: string,
  projectName: string,
  credentials?: HarborCredentials,
): Promise<HarborRepository[]> {
  const url = `${baseUrl}/api/v2.0/projects/${projectName}/repositories?page_size=100`;
  const response = await fetch(url, { headers: buildHeaders(credentials) });
  if (!response.ok) {
    throw new Error(`Harbor API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<HarborRepository[]>;
}

export async function listArtifacts(
  baseUrl: string,
  projectName: string,
  repoName: string,
  credentials?: HarborCredentials,
): Promise<HarborArtifact[]> {
  const encodedRepo = encodeURIComponent(repoName);
  const url = `${baseUrl}/api/v2.0/projects/${projectName}/repositories/${encodedRepo}/artifacts?with_tag=true&page_size=100`;
  const response = await fetch(url, { headers: buildHeaders(credentials) });
  if (!response.ok) {
    throw new Error(`Harbor API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<HarborArtifact[]>;
}
