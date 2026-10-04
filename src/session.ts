import * as vscode from "vscode";
import { HarborClient } from "./harbor/client";
import { HarborCredentials } from "./harbor/types";
import { normalizeRegistryUrl } from "./harbor/url";

export interface HarborConnection {
  /** Normalized origin of the Harbor instance. */
  url: string;
  /** Undefined when browsing anonymously. */
  credentials?: HarborCredentials;
}

const CONNECTION_KEY = "harborbrowser.connection";
/** Keys written by versions up to 1.0.0, migrated on first load. */
const LEGACY_KEYS = { url: "harbor.url", username: "harbor.username", password: "harbor.password" };
const CONNECTED_CONTEXT_KEY = "harborbrowser.connected";

/**
 * Holds the active connection, persisted as a single entry in SecretStorage
 * (system keychain) so that URL and credentials are always written together.
 */
export class HarborSession implements vscode.Disposable {
  private connection: HarborConnection | undefined;
  private client: HarborClient | undefined;
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [this.changeEmitter];

  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly log: vscode.LogOutputChannel,
  ) {
    // Keeps several windows in sync when the user connects or disconnects in one of them.
    this.disposables.push(
      secrets.onDidChange((event) => {
        if (event.key === CONNECTION_KEY) {
          void this.reload();
        }
      }),
    );
  }

  get current(): { connection: HarborConnection; client: HarborClient } | undefined {
    return this.connection && this.client
      ? { connection: this.connection, client: this.client }
      : undefined;
  }

  async initialize(): Promise<void> {
    await this.migrateLegacySecrets();
    await this.reload();
  }

  async connect(connection: HarborConnection): Promise<void> {
    await this.secrets.store(CONNECTION_KEY, JSON.stringify(connection));
    await this.apply(connection);
  }

  async disconnect(): Promise<void> {
    await this.secrets.delete(CONNECTION_KEY);
    await this.apply(undefined);
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private async reload(): Promise<void> {
    await this.apply(await this.readStoredConnection());
  }

  private async readStoredConnection(): Promise<HarborConnection | undefined> {
    const raw = await this.secrets.get(CONNECTION_KEY);
    if (!raw) {
      return undefined;
    }
    try {
      const stored = JSON.parse(raw) as Partial<HarborConnection>;
      const url = typeof stored.url === "string" ? normalizeRegistryUrl(stored.url) : undefined;
      if (!url) {
        throw new Error("missing or invalid URL");
      }
      const { username, password } = stored.credentials ?? {};
      const credentials = username && password ? { username, password } : undefined;
      return { url, credentials };
    } catch (error) {
      this.log.warn(`Ignoring unreadable stored connection: ${String(error)}`);
      return undefined;
    }
  }

  private async apply(connection: HarborConnection | undefined): Promise<void> {
    if (sameConnection(this.connection, connection)) {
      return;
    }
    this.connection = connection;
    this.client = connection
      ? new HarborClient({ baseUrl: connection.url, credentials: connection.credentials })
      : undefined;
    await vscode.commands.executeCommand("setContext", CONNECTED_CONTEXT_KEY, !!connection);
    this.changeEmitter.fire();
  }

  private async migrateLegacySecrets(): Promise<void> {
    const legacyUrl = await this.secrets.get(LEGACY_KEYS.url);
    if (!legacyUrl) {
      return;
    }
    const url = normalizeRegistryUrl(legacyUrl);
    if (url && !(await this.secrets.get(CONNECTION_KEY))) {
      const username = await this.secrets.get(LEGACY_KEYS.username);
      const password = await this.secrets.get(LEGACY_KEYS.password);
      const connection: HarborConnection = {
        url,
        credentials: username && password ? { username, password } : undefined,
      };
      await this.secrets.store(CONNECTION_KEY, JSON.stringify(connection));
      this.log.info(`Migrated the saved connection to ${url} from a previous version.`);
    }
    for (const key of Object.values(LEGACY_KEYS)) {
      await this.secrets.delete(key);
    }
  }
}

function sameConnection(a: HarborConnection | undefined, b: HarborConnection | undefined): boolean {
  return (
    a?.url === b?.url &&
    a?.credentials?.username === b?.credentials?.username &&
    a?.credentials?.password === b?.credentials?.password
  );
}
