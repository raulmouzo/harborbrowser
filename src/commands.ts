import * as vscode from "vscode";
import { connect } from "./connect";
import { ImageClient, isImageClient, portalUrls, pullCommand } from "./harbor/references";
import { HarborSession } from "./session";
import { ArtifactNode, HarborNode, ProjectsProvider } from "./views/projectsView";

export function registerCommands(
  session: HarborSession,
  provider: ProjectsProvider,
  log: vscode.LogOutputChannel,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("harborbrowser.login", () => connect(session, log)),

    vscode.commands.registerCommand("harborbrowser.logout", async () => {
      await session.disconnect();
      log.info("Disconnected and removed the saved connection.");
    }),

    vscode.commands.registerCommand("harborbrowser.refresh", () => provider.refresh()),

    vscode.commands.registerCommand("harborbrowser.showLogs", () => log.show()),

    vscode.commands.registerCommand("harborbrowser.copyImageName", (node?: HarborNode) =>
      isArtifact(node) ? copy(node.reference) : undefined,
    ),

    vscode.commands.registerCommand("harborbrowser.copyPullCommand", (node?: HarborNode) => {
      if (!isArtifact(node)) {
        return undefined;
      }
      const command = pullCommand(node.repositoryReference, node.artifact, node.tag, configuredImageClient());
      return command ? copy(command) : undefined;
    }),

    vscode.commands.registerCommand("harborbrowser.openInBrowser", async (node?: HarborNode) => {
      const url = node ? portalUrl(node) : undefined;
      if (url) {
        await vscode.env.openExternal(vscode.Uri.parse(url, true));
      }
    }),
  ];
}

/** Read when copying, so changes to the setting apply without refreshing the tree. */
function configuredImageClient(): ImageClient {
  const value = vscode.workspace.getConfiguration("harborbrowser").get<string>("pullCommand.client");
  return isImageClient(value) ? value : "docker";
}

function isArtifact(node: HarborNode | undefined): node is ArtifactNode {
  return node?.kind === "artifact";
}

async function copy(text: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  vscode.window.setStatusBarMessage(`$(check) Copied ${text}`, 4000);
}

/** Portal page for a node; nested repositories fall back to their project (see portalUrls). */
function portalUrl(node: HarborNode): string | undefined {
  switch (node.kind) {
    case "project":
      return portalUrls.project(node.baseUrl, node.project.project_id);
    case "repository":
      return portalUrls.repository(node.baseUrl, node.project.project_id, node.shortName)
        ?? portalUrls.project(node.baseUrl, node.project.project_id);
    case "artifact":
      return portalUrls.artifact(node.baseUrl, node.project.project_id, node.shortName, node.artifact.digest)
        ?? portalUrls.project(node.baseUrl, node.project.project_id);
    default:
      return undefined;
  }
}
