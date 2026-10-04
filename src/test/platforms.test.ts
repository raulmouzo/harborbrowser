import * as assert from "assert";
import { artifactPlatforms, summarizePlatforms } from "../harbor/platforms";
import { HarborArtifact } from "../harbor/types";

function artifact(extra: Partial<HarborArtifact>): HarborArtifact {
  return { id: 1, type: "IMAGE", digest: "sha256:aa", size: 1, push_time: "2026-01-01T00:00:00Z", tags: null, ...extra };
}

suite("platforms", () => {
  test("lists the platforms of an image index and skips BuildKit attestations", () => {
    const index = artifact({
      references: [
        { child_digest: "sha256:01", platform: { os: "linux", architecture: "amd64" } },
        { child_digest: "sha256:02", platform: { os: "linux", architecture: "arm64", variant: "v8" } },
        {
          child_digest: "sha256:03",
          platform: { os: "unknown", architecture: "unknown" },
          annotations: { "vnd.docker.reference.type": "attestation-manifest" },
        },
        { child_digest: "sha256:04", platform: null },
        { child_digest: "sha256:05", platform: { os: "linux", architecture: "amd64" } },
      ],
    });
    assert.deepStrictEqual(artifactPlatforms(index), ["linux/amd64", "linux/arm64/v8"]);
  });

  test("reads the platform of a single image from its config", () => {
    assert.deepStrictEqual(
      artifactPlatforms(artifact({ extra_attrs: { os: "linux", architecture: "arm64" } })),
      ["linux/arm64"],
    );
    assert.deepStrictEqual(artifactPlatforms(artifact({ type: "CHART", extra_attrs: { name: "web" } })), []);
    assert.deepStrictEqual(artifactPlatforms(artifact({})), []);
  });

  test("summarizePlatforms drops the linux prefix and truncates long lists", () => {
    assert.strictEqual(summarizePlatforms([]), undefined);
    assert.strictEqual(summarizePlatforms(["linux/amd64", "linux/arm64/v8"]), "amd64, arm64/v8");
    assert.strictEqual(summarizePlatforms(["linux/amd64", "windows/amd64"]), "linux/amd64, windows/amd64");
    assert.strictEqual(
      summarizePlatforms(["linux/amd64", "linux/arm/v6", "linux/arm/v7", "linux/arm64/v8", "linux/s390x"]),
      "amd64, arm/v6, arm/v7 +2",
    );
  });
});
