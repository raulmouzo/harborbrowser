import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { HarborSession } from "./session";
import { ProjectsProvider } from "./views/projectsView";
import { VulnerabilityReportProvider } from "./vulnerabilityReports";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("Harbor Browser", { log: true });
  const session = new HarborSession(context.secrets, log);
  const provider = new ProjectsProvider(session, log);
  const reports = new VulnerabilityReportProvider(session, log, () => provider.authMode);
  const treeView = vscode.window.createTreeView("harborbrowser.projects", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    log,
    session,
    provider,
    reports,
    treeView,
    session.onDidChange(() => {
      const current = session.current;
      treeView.description = current ? new URL(current.connection.url).host : undefined;
      provider.refresh();
    }),
    ...registerCommands(session, provider, reports, log),
  );

  try {
    await session.initialize();
  } catch (error) {
    log.error(`Could not read the saved connection: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deactivate(): void {}
