import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension", () => {
  test("activates and registers its commands", async () => {
    const extension = vscode.extensions.getExtension("raulmouzo.harborbrowser");
    assert.ok(extension, "extension not found");
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      "harborbrowser.login",
      "harborbrowser.logout",
      "harborbrowser.refresh",
      "harborbrowser.copyImageName",
      "harborbrowser.copyPullCommand",
      "harborbrowser.openInBrowser",
      "harborbrowser.showVulnerabilities",
      "harborbrowser.showLogs",
    ]) {
      assert.ok(commands.includes(command), `${command} is not registered`);
    }
  });
});
