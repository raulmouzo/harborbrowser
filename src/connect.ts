import * as vscode from "vscode";
import { HarborClient, SystemInfoResult } from "./harbor/client";
import { HarborCredentials } from "./harbor/types";
import { normalizeRegistryUrl } from "./harbor/url";
import { HarborSession } from "./session";

const TITLE = "Connect to Harbor";

interface ModeItem extends vscode.QuickPickItem {
  mode: "credentials" | "anonymous";
}

/**
 * Interactive connection flow: asks for the registry address, checks that it is a
 * reachable Harbor instance, then signs in or continues anonymously.
 * Nothing is stored until Harbor has accepted the connection.
 */
export async function connect(session: HarborSession, log: vscode.LogOutputChannel): Promise<void> {
  const previous = session.current?.connection;

  const address = await vscode.window.showInputBox({
    title: TITLE,
    prompt: "Address of your Harbor instance",
    placeHolder: "https://harbor.example.com",
    value: previous?.url,
    ignoreFocusOut: true,
    validateInput: (value) =>
      normalizeRegistryUrl(value)
        ? undefined
        : "Enter an http:// or https:// address, for example https://harbor.example.com",
  });
  const url = address === undefined ? undefined : normalizeRegistryUrl(address);
  if (!url) {
    return;
  }
  const host = new URL(url).host;

  const anonymous = await tryConnect(`Contacting ${host}…`, new HarborClient({ baseUrl: url }), log);
  if (!anonymous) {
    return;
  }
  const oidcProvider = anonymous.info.auth_mode === "oidc_auth"
    ? anonymous.info.oidc_provider_name || "OIDC"
    : undefined;

  const mode = await vscode.window.showQuickPick<ModeItem>(
    [
      {
        label: "$(account) Sign in",
        detail: oidcProvider
          ? `Harbor username with the CLI secret from your user profile (${oidcProvider} accounts), or a robot account.`
          : "Harbor user account or robot account.",
        mode: "credentials",
      },
      {
        label: "$(globe) Browse anonymously",
        detail: "Only public projects are visible.",
        mode: "anonymous",
      },
    ],
    { title: TITLE, placeHolder: `How do you want to connect to ${host}?`, ignoreFocusOut: true },
  );
  if (!mode) {
    return;
  }

  let credentials: HarborCredentials | undefined;
  if (mode.mode === "credentials") {
    credentials = await askCredentials(oidcProvider, previous?.url === url ? previous.credentials?.username : undefined);
    if (!credentials) {
      return;
    }
    const result = await tryConnect(`Signing in to ${host}…`, new HarborClient({ baseUrl: url, credentials }), log);
    if (!result) {
      return;
    }
    if (!result.credentialsAccepted) {
      const hint = oidcProvider
        ? " With OIDC sign-in, use the CLI secret shown in your Harbor user profile, not your OIDC password."
        : "";
      log.warn(`Harbor at ${url} rejected the credentials for ${credentials.username}.`);
      const choice = await vscode.window.showErrorMessage(
        `Harbor rejected the credentials for "${credentials.username}".${hint}`,
        "Try Again",
      );
      if (choice) {
        await connect(session, log);
      }
      return;
    }
  }

  await session.connect({ url, credentials });
  log.info(`Connected to ${url} ${credentials ? `as ${credentials.username}` : "anonymously"}.`);
  void vscode.window.showInformationMessage(
    credentials
      ? `Connected to ${host} as ${credentials.username}.`
      : `Connected to ${host} anonymously. Only public projects are visible.`,
  );
}

async function askCredentials(
  oidcProvider: string | undefined,
  previousUsername: string | undefined,
): Promise<HarborCredentials | undefined> {
  const username = await vscode.window.showInputBox({
    title: TITLE,
    prompt: "Harbor username or robot account name",
    placeHolder: "jdoe or robot$project+ci",
    value: previousUsername,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? undefined : "Enter a username"),
  });
  if (!username?.trim()) {
    return undefined;
  }
  const password = await vscode.window.showInputBox({
    title: TITLE,
    prompt: oidcProvider
      ? "CLI secret (Harbor web UI → your user profile) or robot account secret"
      : "Password or robot account secret",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value ? undefined : "Enter a password or secret"),
  });
  if (!password) {
    return undefined;
  }
  return { username: username.trim(), password };
}

async function tryConnect(
  progressTitle: string,
  client: HarborClient,
  log: vscode.LogOutputChannel,
): Promise<SystemInfoResult | undefined> {
  try {
    return await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: progressTitle },
      () => client.getSystemInfo(),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log.error(`Connection to ${client.baseUrl} failed: ${detail}`);
    const choice = await vscode.window.showErrorMessage(detail, "Show Logs");
    if (choice) {
      log.show();
    }
    return undefined;
  }
}
