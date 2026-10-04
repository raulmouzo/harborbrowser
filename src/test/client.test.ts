import * as assert from "assert";
import * as http from "http";
import { AddressInfo } from "net";
import { HarborClient } from "../harbor/client";
import { HarborApiError, HarborConnectionError } from "../harbor/errors";

type Handler = (request: http.IncomingMessage, response: http.ServerResponse) => void;

/** Minimal local HTTP server standing in for a Harbor instance. */
async function withServer(handler: Handler, run: (baseUrl: string, requests: string[]) => Promise<void>): Promise<void> {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

suite("HarborClient", () => {
  test("collects every page using page_size=100 and X-Total-Count", async () => {
    const projects = Array.from({ length: 250 }, (_, i) => ({ project_id: i + 1, name: `p${i + 1}` }));
    await withServer((request, response) => {
      const url = new URL(request.url ?? "", "http://localhost");
      const page = Number(url.searchParams.get("page"));
      const size = Number(url.searchParams.get("page_size"));
      sendJson(response, 200, projects.slice((page - 1) * size, page * size), { "X-Total-Count": "250" });
    }, async (baseUrl, requests) => {
      const result = await new HarborClient({ baseUrl }).listProjects("public");
      assert.strictEqual(result.length, 250);
      assert.strictEqual(requests.length, 3);
      assert.ok(requests.every((r) => r.includes("page_size=100") && r.includes("public=true")));
    });
  });

  test("stops at a short page when X-Total-Count is missing", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, [{ id: 1, project_id: 1, name: "p/one" }]);
    }, async (baseUrl, requests) => {
      const result = await new HarborClient({ baseUrl }).listRepositories("p");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(requests.length, 1);
    });
  });

  test("double-encodes nested repository names when listing artifacts", async () => {
    await withServer((_request, response) => sendJson(response, 200, []), async (baseUrl, requests) => {
      await new HarborClient({ baseUrl }).listArtifacts("team", "apps/api");
      const path = requests[0].split("?")[0];
      assert.strictEqual(path, "/api/v2.0/projects/team/repositories/apps%252Fapi/artifacts");
      assert.match(requests[0], /with_tag=true/);
      assert.match(requests[0], /sort=-push_time/);
    });
  });

  test("requests scan overviews with the report formats of the Harbor portal", async () => {
    let accept: string | undefined;
    await withServer((request, response) => {
      accept = request.headers["x-accept-vulnerabilities"] as string | undefined;
      sendJson(response, 200, []);
    }, async (baseUrl, requests) => {
      await new HarborClient({ baseUrl }).listArtifacts("library", "nginx");
      assert.match(requests[0], /with_scan_overview=true/);
      assert.match(accept ?? "", /^application\/vnd\.security\.vulnerability\.report; version=1\.1, /);
    });
  });

  test("returns the vulnerability report of an artifact, or undefined when there is none", async () => {
    const digest = "sha256:abc";
    await withServer((request, response) => {
      if (request.url?.includes("/repositories/apps%252Fapi/artifacts/sha256%3Aabc/additions/vulnerabilities")) {
        sendJson(response, 200, { "application/vnd.security.vulnerability.report; version=1.1": { severity: "High", vulnerabilities: [] } });
      } else {
        sendJson(response, 200, {});
      }
    }, async (baseUrl) => {
      const client = new HarborClient({ baseUrl });
      assert.strictEqual((await client.getVulnerabilityReport("team", "apps/api", digest))?.severity, "High");
      assert.strictEqual(await client.getVulnerabilityReport("team", "other", digest), undefined);
    });
  });

  test("detects accepted credentials through the protected systeminfo fields", async () => {
    let authorization: string | undefined;
    await withServer((request, response) => {
      authorization = request.headers.authorization;
      sendJson(response, 200, { auth_mode: "db_auth", harbor_version: "v2.15.0", registry_url: "registry.example.com" });
    }, async (baseUrl) => {
      const client = new HarborClient({ baseUrl, credentials: { username: "robot$ci", password: "s3cret" } });
      const result = await client.getSystemInfo();
      assert.strictEqual(result.credentialsAccepted, true);
      assert.strictEqual(result.info.registry_url, "registry.example.com");
      assert.strictEqual(authorization, `Basic ${Buffer.from("robot$ci:s3cret").toString("base64")}`);
    });
  });

  test("reports rejected credentials when Harbor falls back to an anonymous answer", async () => {
    await withServer((_request, response) => sendJson(response, 200, { auth_mode: "db_auth" }), async (baseUrl) => {
      const client = new HarborClient({ baseUrl, credentials: { username: "jdoe", password: "wrong" } });
      assert.strictEqual((await client.getSystemInfo()).credentialsAccepted, false);
      assert.strictEqual((await new HarborClient({ baseUrl }).getSystemInfo()).credentialsAccepted, undefined);
    });
  });

  test("rejects servers that are not Harbor", async () => {
    await withServer((request, response) => {
      if (request.url?.startsWith("/api/v2.0/systeminfo")) {
        sendJson(response, 200, { hello: "world" });
      } else {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end("<html></html>");
      }
    }, async (baseUrl) => {
      const client = new HarborClient({ baseUrl });
      await assert.rejects(client.getSystemInfo(), /does not look like a Harbor v2 instance/);
      await assert.rejects(client.listProjects("public"), /is not JSON/);
    });
  });

  test("surfaces the message of Harbor error payloads", async () => {
    await withServer((_request, response) => {
      sendJson(response, 403, { errors: [{ code: "FORBIDDEN", message: "forbidden by policy" }] });
    }, async (baseUrl) => {
      await assert.rejects(new HarborClient({ baseUrl }).listRepositories("secret"), (error: unknown) => {
        assert.ok(error instanceof HarborApiError);
        assert.strictEqual(error.status, 403);
        assert.match(error.message, /forbidden by policy/);
        return true;
      });
    });
  });

  test("wraps network failures in HarborConnectionError", async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    await assert.rejects(new HarborClient({ baseUrl: `http://127.0.0.1:${port}` }).getSystemInfo(), (error: unknown) => {
      assert.ok(error instanceof HarborConnectionError);
      assert.match(error.message, /Could not reach http:\/\/127\.0\.0\.1/);
      return true;
    });
  });
});
