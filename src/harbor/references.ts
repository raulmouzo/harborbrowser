import { HarborArtifact } from "./types";

/**
 * Host (and port) used in image references. Prefers the `registry_url` reported
 * by `GET /systeminfo`, which is what the Harbor portal uses for its pull commands,
 * and falls back to the host of the API URL.
 */
export function registryHost(baseUrl: string, systemRegistryUrl?: string): string {
  if (systemRegistryUrl) {
    // registry_url may or may not include a scheme depending on the deployment.
    const withoutScheme = systemRegistryUrl.replace(/^[a-z][a-z\d+.-]*:\/\//i, "");
    const host = withoutScheme.replace(/\/+$/, "");
    if (host) {
      return host;
    }
  }
  return new URL(baseUrl).host;
}

/** `<host>/<project>/<repository>` */
export function repositoryReference(host: string, repositoryFullName: string): string {
  return `${host}/${repositoryFullName}`;
}

/** `<host>/<project>/<repository>:<tag>` or `…@<digest>` when there is no tag. */
export function imageReference(repository: string, artifact: HarborArtifact, tag?: string): string {
  return tag ? `${repository}:${tag}` : `${repository}@${artifact.digest}`;
}

/**
 * Pull command for an artifact, mirroring the Harbor portal:
 * images use docker, CNAB bundles use cnab-to-oci, Helm charts use `helm pull oci://`
 * (only possible with a tag). Other artifact types have no pull command.
 */
export function pullCommand(repository: string, artifact: HarborArtifact, tag?: string): string | undefined {
  switch (artifact.type) {
    case "IMAGE":
      return `docker pull ${imageReference(repository, artifact, tag)}`;
    case "CNAB":
      return `cnab-to-oci pull ${imageReference(repository, artifact, tag)}`;
    case "CHART":
      return tag ? `helm pull oci://${repository} --version ${tag}` : undefined;
    default:
      return undefined;
  }
}

/**
 * Harbor portal routes (see src/portal in goharbor/harbor).
 *
 * The portal expects the repository name as a single path segment, so a nested
 * name such as "team/app" must be sent as "team%2Fapp". `vscode.env.openExternal`
 * only accepts a `vscode.Uri`, which always decodes "%2F" back into "/", so links
 * to nested repositories cannot be opened reliably; those return undefined and
 * callers fall back to the project page.
 */
export const portalUrls = {
  project(baseUrl: string, projectId: number): string {
    return `${baseUrl}/harbor/projects/${projectId}/repositories`;
  },
  repository(baseUrl: string, projectId: number, repositoryShortName: string): string | undefined {
    if (repositoryShortName.includes("/")) {
      return undefined;
    }
    return `${baseUrl}/harbor/projects/${projectId}/repositories/${encodeURIComponent(repositoryShortName)}/artifacts-tab`;
  },
  artifact(baseUrl: string, projectId: number, repositoryShortName: string, digest: string): string | undefined {
    const repository = portalUrls.repository(baseUrl, projectId, repositoryShortName);
    return repository && `${repository}/artifacts/${digest}`;
  },
};
