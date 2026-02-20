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

async function fetchProjects(
  baseUrl: string,
  isPublic: boolean,
  credentials?: HarborCredentials,
): Promise<HarborProject[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (credentials) {
    const encoded = Buffer.from(
      `${credentials.username}:${credentials.password}`,
    ).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  const requestUrl = `${baseUrl}/api/v2.0/projects?public=${isPublic}&page_size=100`;
  const response = await fetch(requestUrl, { headers });

  if (!response.ok) {
    throw new Error(
      `Harbor API error: ${response.status} ${response.statusText}`,
    );
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
