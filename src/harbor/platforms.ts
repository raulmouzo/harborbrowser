import { HarborArtifact, HarborPlatform, HarborReference } from "./types";

/**
 * Platforms an artifact can run on, as `os/architecture[/variant]`:
 * - image indexes list the platform of each referenced manifest;
 * - single images report the `os` and `architecture` of their config.
 *
 * Attestation manifests added by BuildKit are skipped: they are marked with the
 * `vnd.docker.reference.type: attestation-manifest` annotation and the
 * `unknown/unknown` platform (see moby/buildkit docs/attestations/attestation-storage.md).
 */
export function artifactPlatforms(artifact: HarborArtifact): string[] {
  if (artifact.references?.length) {
    const platforms = artifact.references
      .filter((reference) => !isAttestation(reference))
      .map((reference) => formatPlatform(reference.platform))
      .filter((platform): platform is string => platform !== undefined);
    return [...new Set(platforms)];
  }
  const os = artifact.extra_attrs?.os;
  const architecture = artifact.extra_attrs?.architecture;
  const single = formatPlatform({
    os: typeof os === "string" ? os : undefined,
    architecture: typeof architecture === "string" ? architecture : undefined,
  });
  return single ? [single] : [];
}

/**
 * Compact form for tree item descriptions: the "linux/" prefix is dropped when
 * every platform is Linux, and only the first entries are listed.
 */
export function summarizePlatforms(platforms: string[], maxShown = 3): string | undefined {
  if (platforms.length === 0) {
    return undefined;
  }
  const allLinux = platforms.every((platform) => platform.startsWith("linux/"));
  const names = allLinux ? platforms.map((platform) => platform.slice("linux/".length)) : platforms;
  const shown = names.slice(0, maxShown).join(", ");
  const hidden = names.length - maxShown;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
}

function isAttestation(reference: HarborReference): boolean {
  return reference.annotations?.["vnd.docker.reference.type"] === "attestation-manifest";
}

function formatPlatform(platform: HarborPlatform | null | undefined): string | undefined {
  const { os, architecture, variant } = platform ?? {};
  if (!os || !architecture || os === "unknown" || architecture === "unknown") {
    return undefined;
  }
  return [os, architecture, variant].filter(Boolean).join("/");
}
