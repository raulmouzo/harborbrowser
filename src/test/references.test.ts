import * as assert from "assert";
import { imageReference, isImageClient, portalUrls, pullCommand, registryHost } from "../harbor/references";
import { HarborArtifact } from "../harbor/types";

const digest = "sha256:954b378c375d852eb3c63ab88978f640b4348b01c1b3456a024a81536dafbbf4";

function artifact(type: string): HarborArtifact {
  return { id: 1, type, digest, size: 1, push_time: "2026-01-01T00:00:00Z", tags: null };
}

suite("references", () => {
  test("registryHost prefers the registry_url reported by Harbor", () => {
    assert.strictEqual(registryHost("https://api.example.com", "registry.example.com"), "registry.example.com");
    assert.strictEqual(registryHost("https://api.example.com", "https://registry.example.com:5000/"), "registry.example.com:5000");
    assert.strictEqual(registryHost("https://harbor.example.com:8443"), "harbor.example.com:8443");
  });

  test("imageReference uses the tag or falls back to the digest", () => {
    assert.strictEqual(imageReference("h/p/r", artifact("IMAGE"), "1.0"), "h/p/r:1.0");
    assert.strictEqual(imageReference("h/p/r", artifact("IMAGE")), `h/p/r@${digest}`);
  });

  test("pullCommand mirrors the Harbor portal for each artifact type", () => {
    assert.strictEqual(pullCommand("h/p/r", artifact("IMAGE"), "1.0"), "docker pull h/p/r:1.0");
    assert.strictEqual(pullCommand("h/p/r", artifact("IMAGE")), `docker pull h/p/r@${digest}`);
    assert.strictEqual(pullCommand("h/p/chart", artifact("CHART"), "0.1.0"), "helm pull oci://h/p/chart --version 0.1.0");
    assert.strictEqual(pullCommand("h/p/chart", artifact("CHART")), undefined);
    assert.strictEqual(pullCommand("h/p/b", artifact("CNAB"), "v1"), "cnab-to-oci pull h/p/b:v1");
    assert.strictEqual(pullCommand("h/p/x", artifact("OPENPOLICYAGENT"), "v1"), undefined);
  });

  test("pullCommand uses the chosen client for container images only", () => {
    assert.strictEqual(pullCommand("h/p/r", artifact("IMAGE"), "1.0", "podman"), "podman pull h/p/r:1.0");
    assert.strictEqual(pullCommand("h/p/r", artifact("IMAGE"), undefined, "podman"), `podman pull h/p/r@${digest}`);
    assert.strictEqual(pullCommand("h/p/chart", artifact("CHART"), "0.1.0", "podman"), "helm pull oci://h/p/chart --version 0.1.0");
    assert.strictEqual(pullCommand("h/p/b", artifact("CNAB"), "v1", "podman"), "cnab-to-oci pull h/p/b:v1");
  });

  test("isImageClient only accepts the supported clients", () => {
    assert.ok(isImageClient("docker"));
    assert.ok(isImageClient("podman"));
    assert.ok(!isImageClient("nerdctl"));
    assert.ok(!isImageClient(undefined));
  });

  test("portal URLs follow the Harbor portal routes", () => {
    const base = "https://harbor.example.com";
    assert.strictEqual(portalUrls.project(base, 3), `${base}/harbor/projects/3/repositories`);
    assert.strictEqual(
      portalUrls.repository(base, 3, "nginx"),
      `${base}/harbor/projects/3/repositories/nginx/artifacts-tab`,
    );
    assert.strictEqual(
      portalUrls.artifact(base, 3, "nginx", digest),
      `${base}/harbor/projects/3/repositories/nginx/artifacts-tab/artifacts/${digest}`,
    );
  });

  test("portal URLs are not built for nested repositories", () => {
    assert.strictEqual(portalUrls.repository("https://h", 3, "team/app"), undefined);
    assert.strictEqual(portalUrls.artifact("https://h", 3, "team/app", digest), undefined);
  });
});
