import * as assert from "assert";
import { encodeRepositoryPathSegment, normalizeRegistryUrl, repositoryShortName } from "../harbor/url";

suite("url", () => {
  test("normalizeRegistryUrl defaults to https and keeps ports", () => {
    assert.strictEqual(normalizeRegistryUrl("harbor.example.com"), "https://harbor.example.com");
    assert.strictEqual(normalizeRegistryUrl("  harbor.example.com:8443 "), "https://harbor.example.com:8443");
    assert.strictEqual(normalizeRegistryUrl("http://10.0.0.5"), "http://10.0.0.5");
  });

  test("normalizeRegistryUrl drops trailing slashes and portal paths", () => {
    assert.strictEqual(normalizeRegistryUrl("https://harbor.example.com/"), "https://harbor.example.com");
    assert.strictEqual(
      normalizeRegistryUrl("https://harbor.example.com/harbor/projects/3/repositories"),
      "https://harbor.example.com",
    );
  });

  test("normalizeRegistryUrl rejects invalid input", () => {
    assert.strictEqual(normalizeRegistryUrl(""), undefined);
    assert.strictEqual(normalizeRegistryUrl("ftp://harbor.example.com"), undefined);
    assert.strictEqual(normalizeRegistryUrl("https://user:pass@harbor.example.com"), undefined);
    assert.strictEqual(normalizeRegistryUrl("http://"), undefined);
  });

  test("repositoryShortName strips only the project prefix", () => {
    assert.strictEqual(repositoryShortName("library", "library/nginx"), "nginx");
    assert.strictEqual(repositoryShortName("team", "team/apps/api"), "apps/api");
    assert.strictEqual(repositoryShortName("team", "other/api"), "other/api");
  });

  test("encodeRepositoryPathSegment encodes twice as the Harbor API requires", () => {
    assert.strictEqual(encodeRepositoryPathSegment("nginx"), "nginx");
    assert.strictEqual(encodeRepositoryPathSegment("a/b"), "a%252Fb");
  });
});
