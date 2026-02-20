import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("HarborBrowser activated");

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

      await context.secrets.store("harbor.url", url);
      await context.secrets.store("harbor.username", username);
      await context.secrets.store("harbor.password", password);

      vscode.window.showInformationMessage(
        `Harbor credentials saved for ${username}`,
      );
    },
  );

  context.subscriptions.push(loginCommand);
}

export function deactivate() {}
