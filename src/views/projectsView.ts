import * as vscode from "vscode";
import {
  HarborArtifact,
  HarborCredentials,
  HarborProject,
  HarborRepository,
  listArtifacts,
  listPrivateProjects,
  listPublicProjects,
  listRepositories,
} from "../harbor/client";

type NodeType =
  | "section-public"
  | "section-private"
  | "project"
  | "repository"
  | "artifact"
  | "message";

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class HarborTreeItem extends vscode.TreeItem {
  constructor(
    public readonly nodeType: NodeType,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly project?: HarborProject,
    public readonly repository?: HarborRepository,
    public readonly artifact?: HarborArtifact,
    public readonly tagName?: string,
    public readonly imageRef?: string,
  ) {
    super(label, collapsibleState);
    this.contextValue = nodeType;

    if (nodeType === "project" && project) {
      this.description = `${project.repo_count} repos`;
      this.tooltip = project.name;
      this.iconPath = new vscode.ThemeIcon("folder");
    }

    if (nodeType === "repository" && repository) {
      this.description = `${repository.artifact_count} images`;
      this.iconPath = new vscode.ThemeIcon("package");
    }

    if (nodeType === "artifact" && artifact) {
      const date = new Date(artifact.push_time).toLocaleDateString();
      const size = formatBytes(artifact.size);
      this.description = `${date} · ${size}`;
      this.tooltip = new vscode.MarkdownString(
        `**Digest:** \`${artifact.digest}\``,
      );
      this.iconPath = new vscode.ThemeIcon("tag");
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

  getBaseUrl(): string | undefined {
    return this.credentials?.url;
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
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      return [
        new HarborTreeItem(
          "section-public",
          "Public Projects",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
        new HarborTreeItem(
          "section-private",
          "Private Projects",
          vscode.TreeItemCollapsibleState.Collapsed,
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
              vscode.TreeItemCollapsibleState.None,
            ),
          ];
        }
        return projects.map(
          (p) =>
            new HarborTreeItem(
              "project",
              p.name,
              vscode.TreeItemCollapsibleState.Collapsed,
              p,
            ),
        );
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading projects",
            vscode.TreeItemCollapsibleState.None,
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
              vscode.TreeItemCollapsibleState.None,
            ),
          ];
        }
        return projects.map(
          (p) =>
            new HarborTreeItem(
              "project",
              p.name,
              vscode.TreeItemCollapsibleState.Collapsed,
              p,
            ),
        );
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading projects",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
    }

    if (element.nodeType === "project" && element.project && this.credentials) {
      try {
        const creds = element.project.public ? undefined : this.credentials;
        const repos = await listRepositories(
          this.credentials.url,
          element.project.name,
          creds,
        );
        if (repos.length === 0) {
          return [
            new HarborTreeItem(
              "message",
              "No repositories",
              vscode.TreeItemCollapsibleState.None,
            ),
          ];
        }
        return repos.map((r) => {
          const repoShortName = r.name.replace(`${element.project!.name}/`, "");
          return new HarborTreeItem(
            "repository",
            repoShortName,
            vscode.TreeItemCollapsibleState.Collapsed,
            element.project,
            r,
          );
        });
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading repositories",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
    }

    if (
      element.nodeType === "repository" &&
      element.repository &&
      element.project &&
      this.credentials
    ) {
      try {
        const creds = element.project.public ? undefined : this.credentials;
        const projectName = element.project.name;
        const repoShortName = element.repository.name.replace(
          `${projectName}/`,
          "",
        );
        const artifacts = await listArtifacts(
          this.credentials.url,
          projectName,
          repoShortName,
          creds,
        );
        if (artifacts.length === 0) {
          return [
            new HarborTreeItem(
              "message",
              "No artifacts",
              vscode.TreeItemCollapsibleState.None,
            ),
          ];
        }

        const registryHost = new URL(this.credentials.url).host;
        const items: HarborTreeItem[] = [];

        for (const artifact of artifacts) {
          const tags = artifact.tags ?? [];
          if (tags.length === 0) {
            const shortDigest = artifact.digest.substring(7, 19);
            const imageRef = `${registryHost}/${projectName}/${repoShortName}@${artifact.digest}`;
            items.push(
              new HarborTreeItem(
                "artifact",
                `<untagged> ${shortDigest}`,
                vscode.TreeItemCollapsibleState.None,
                element.project,
                element.repository,
                artifact,
                undefined,
                imageRef,
              ),
            );
          } else {
            for (const tag of tags) {
              const imageRef = `${registryHost}/${projectName}/${repoShortName}:${tag.name}`;
              items.push(
                new HarborTreeItem(
                  "artifact",
                  tag.name,
                  vscode.TreeItemCollapsibleState.None,
                  element.project,
                  element.repository,
                  artifact,
                  tag.name,
                  imageRef,
                ),
              );
            }
          }
        }

        return items;
      } catch {
        return [
          new HarborTreeItem(
            "message",
            "Error loading artifacts",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
    }

    return [];
  }
}
