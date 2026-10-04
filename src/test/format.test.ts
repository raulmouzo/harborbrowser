import * as assert from "assert";
import { formatBytes, pluralize, shortDigest } from "../format";

suite("format", () => {
  test("formatBytes uses binary units", () => {
    assert.strictEqual(formatBytes(0), "0 B");
    assert.strictEqual(formatBytes(512), "512 B");
    assert.strictEqual(formatBytes(1536), "1.5 KiB");
    assert.strictEqual(formatBytes(5 * 1024 * 1024), "5 MiB");
    assert.strictEqual(formatBytes(3.25 * 1024 ** 3), "3.3 GiB");
  });

  test("formatBytes handles invalid sizes", () => {
    assert.strictEqual(formatBytes(-1), "0 B");
    assert.strictEqual(formatBytes(Number.NaN), "0 B");
  });

  test("pluralize", () => {
    assert.strictEqual(pluralize(1, "repository", "repositories"), "1 repository");
    assert.strictEqual(pluralize(0, "repository", "repositories"), "0 repositories");
    assert.strictEqual(pluralize(3, "artifact", "artifacts"), "3 artifacts");
  });

  test("shortDigest keeps the first 12 hex characters", () => {
    assert.strictEqual(
      shortDigest("sha256:954b378c375d852eb3c63ab88978f640b4348b01c1b3456a024a81536dafbbf4"),
      "954b378c375d",
    );
  });
});
