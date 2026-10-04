/**
 * Normalizes the registry address typed by the user into the origin Harbor is
 * served from (scheme, host and optional port). Harbor is always served from the
 * root path, so any path is dropped: pasting a portal URL such as
 * "https://harbor.example.com/harbor/projects/3" works too.
 * Defaults to https when no scheme is given. Returns undefined for invalid input.
 */
export function normalizeRegistryUrl(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) {
    return undefined;
  }
  if (url.username || url.password) {
    return undefined;
  }
  return url.origin;
}

/** Repository name without the leading "<project>/" segment. */
export function repositoryShortName(projectName: string, repositoryName: string): string {
  const prefix = `${projectName}/`;
  return repositoryName.startsWith(prefix)
    ? repositoryName.slice(prefix.length)
    : repositoryName;
}

/**
 * Encodes a repository name for use as a path segment of the Harbor API.
 * The API requires names containing slashes to be encoded twice
 * ("a/b" -> "a%2Fb" -> "a%252Fb").
 */
export function encodeRepositoryPathSegment(repositoryShortName: string): string {
  return encodeURIComponent(encodeURIComponent(repositoryShortName));
}
