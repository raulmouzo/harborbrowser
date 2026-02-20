import * as vscode from "vscode";
import { HarborCredentials } from "./harbor/client";
import { HarborTreeItem, ProjectsProvider } from "./views/projectsView";

export function activate(context: vscode.ExtensionContext) {
  console.log("HarborBrowser activated");

  const provider = new ProjectsProvider(undefined);

  vscode.window.createTreeView("harborbrowser.projects", {
    treeDataProvider: provider,
  });

  context.secrets.get("harbor.url").then(async (url) => {
    if (!url) {
      return;
    }
    const username = (await context.secrets.get("harbor.username")) || "";
    const password = (await context.secrets.get("harbor.password")) || "";
    if (username && password) {
      provider.setCredentials({ url, username, password });
    }
  });

  const loginCommand = vscode.commands.registerCommand(
    "harborbrowser.login",
    async () => {
      const storedUrl = await context.secrets.get("harbor.url");
      const storedUsername = await context.secrets.get("harbor.username");

      const url = await vscode.window.showInputBox({
        prompt: "Harbor URL",
        placeHolder: "https://harbor.example.com",
        value: storedUrl,
        ignoreFocusOut: true,
      });
      if (!url) {
        return;
      }

      const username = await vscode.window.showInputBox({
        prompt: "Username",
        value: storedUsername,
        ignoreFocusOut: true,
      });
      if (!username) {
        return;
      }

      const password = await vscode.window.showInputBox({
        prompt: "Password or CLI secret",
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) {
        return;
      }

      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      await context.secrets.store("harbor.url", normalizedUrl);
      await context.secrets.store("harbor.username", username);
      await context.secrets.store("harbor.password", password);

      const credentials: HarborCredentials = {
        url: normalizedUrl,
        username,
        password,
      };
      provider.setCredentials(credentials);

      vscode.window.showInformationMessage(
        `Harbor credentials saved for ${username}`,
      );
    },
  );

  const refreshCommand = vscode.commands.registerCommand(
    "harborbrowser.refresh",
    () => {
      provider.refresh();
    },
  );

  const copyImageNameCommand = vscode.commands.registerCommand(
    "harborbrowser.copyImageName",
    (item: HarborTreeItem) => {
      if (item.imageRef) {
        vscode.env.clipboard.writeText(item.imageRef);
        vscode.window.showInformationMessage(`Copied: ${item.imageRef}`);
      }
    },
  );

  const copyPullCommandCommand = vscode.commands.registerCommand(
    "harborbrowser.copyPullCommand",
    (item: HarborTreeItem) => {
      if (item.imageRef) {
        const cmd = `docker pull ${item.imageRef}`;
        vscode.env.clipboard.writeText(cmd);
        vscode.window.showInformationMessage(`Copied: ${cmd}`);
      }
    },
  );

  const openInBrowserCommand = vscode.commands.registerCommand(
    "harborbrowser.openInBrowser",
    (item: HarborTreeItem) => {
      const baseUrl = provider.getBaseUrl();
      if (!baseUrl || !item.project) {
        return;
      }

      let url: string;
      if (item.nodeType === "project") {
        url = `${baseUrl}/harbor/projects/${item.project.project_id}/repositories`;
      } else if (item.nodeType === "repository" && item.repository) {
        const repoShortName = item.repository.name.replace(
          `${item.project.name}/`,
          "",
        );
        url = `${baseUrl}/harbor/projects/${item.project.project_id}/repositories/${encodeURIComponent(repoShortName)}`;
      } else if (item.nodeType === "artifact" && item.artifact) {
        const repoShortName = item.repository!.name.replace(
          `${item.project.name}/`,
          "",
        );
        const encodedDigest = encodeURIComponent(item.artifact.digest);
        url = `${baseUrl}/harbor/projects/${item.project.project_id}/repositories/${encodeURIComponent(repoShortName)}/artifacts-tab/artifacts/${encodedDigest}`;
      } else {
        return;
      }

      vscode.env.openExternal(vscode.Uri.parse(url));
    },
  );

  context.subscriptions.push(
    loginCommand,
    refreshCommand,
    copyImageNameCommand,
    copyPullCommandCommand,
    openInBrowserCommand,
  );
}

export function deactivate() {}
