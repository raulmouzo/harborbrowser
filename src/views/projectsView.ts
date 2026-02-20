import * as vscode from "vscode";
import {
  HarborCredentials,
  HarborProject,
  listPrivateProjects,
  listPublicProjects,
} from "../harbor/client";

type NodeType = "section-public" | "section-private" | "project" | "message";

export class HarborTreeItem extends vscode.TreeItem {
  constructor(
    public readonly nodeType: NodeType,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly project?: HarborProject
  ) {
    super(label, collapsibleState);

    if (nodeType === "project" && project) {
      this.description = `${project.repo_count} repos`;
      this.tooltip = project.name;
    }
  }
}

export class ProjectsProvider
  implements vscode.TreeDataProvider<HarborTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private credentials: HarborCredentials | undefined) {}

  setCredentials(credentials: HarborCredentials | undefined) {
    this.credentials = credentials;
    this._onDidChangeTreeData.fire();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HarborTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HarborTreeItem): Promise<HarborTreeItem[]> {
    if (!element) {
      if (!this.credentials) {
        return [
          new HarborTreeItem(
            "message",
            "Login to connect to Harbor",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
      return [
        new HarborTreeItem(
          "section-public",
          "Public Projects",
          vscode.TreeItemCollapsibleState.Collapsed
        ),
        new HarborTreeItem(
          "section-private",
          "Private Projects",
          vscode.TreeItemCollapsibleState.Collapsed
        ),
      ];
    }

    if (element.nodeType === "section-public" && this.credentials) {
      try {
        const projects = await listPublicProjects(this.credentials.url);
        if (projects.length === 0) {
          return [
            new HarborTreeItem(
              "message",
              "No public projects",
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        }
        return projects.map(
          (p) =>
            new HarborTreeItem(
              "project",
              p.name,
              vscode.TreeItemCollapsibleState.None,
              p
            )
        );
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading projects",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
    }

    if (element.nodeType === "section-private" && this.credentials) {
      try {
        const projects = await listPrivateProjects(this.credentials);
        if (projects.length === 0) {
          return [
            new HarborTreeItem(
              "message",
              "No private projects or invalid credentials",
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        }
        return projects.map(
          (p) =>
            new HarborTreeItem(
              "project",
              p.name,
              vscode.TreeItemCollapsibleState.None,
              p
            )
        );
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading projects",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
    }

    return [];
  }
}
