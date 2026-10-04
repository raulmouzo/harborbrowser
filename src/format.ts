const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];

/** Formats a size in bytes with binary units, e.g. 1536 -> "1.5 KiB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${parseFloat(value.toFixed(1))} ${BYTE_UNITS[exponent]}`;
}

/** "1 repository" / "3 repositories" */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** First 12 hex characters of a digest, as shown by the Docker CLI. */
export function shortDigest(digest: string): string {
  const separator = digest.indexOf(":");
  return digest.slice(separator + 1, separator + 13);
}
