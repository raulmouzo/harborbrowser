import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("HarborBrowser activated");

  const loginCommand = vscode.commands.registerCommand(
    "harborbrowser.login",
    async () => {
      const url = await vscode.window.showInputBox({
        prompt: "Harbor URL",
        placeHolder: "https://harbor.example.com",
        ignoreFocusOut: true,
      });
      if (!url) {
        return;
      }

      const username = await vscode.window.showInputBox({
        prompt: "Username",
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
