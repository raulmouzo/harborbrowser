import * as vscode from "vscode";
import { ProjectVisibility } from "../harbor/client";
import { imageReference, pullCommand, registryHost, repositoryReference } from "../harbor/references";
import { ScanState, Severity, scanDescription, scanState, vulnerabilityCounts } from "../harbor/scan";
import { HarborArtifact, HarborProject, HarborRepository, HarborSystemInfo } from "../harbor/types";
import { repositoryShortName } from "../harbor/url";
import { formatBytes, pluralize, shortDigest } from "../format";
import { HarborSession } from "../session";

export interface ConnectionNode {
  kind: "connection";
  host: string;
  username?: string;
  /** Undefined when browsing anonymously. */
  credentialsAccepted?: boolean;
  systemInfo: HarborSystemInfo;
}

export interface SectionNode {
  kind: "section";
  visibility: ProjectVisibility;
  expanded: boolean;
}

export interface ProjectNode {
  kind: "project";
  baseUrl: string;
  project: HarborProject;
}

export interface RepositoryNode {
  kind: "repository";
  baseUrl: string;
  project: HarborProject;
  repository: HarborRepository;
  shortName: string;
}

export interface ArtifactNode {
  kind: "artifact";
  baseUrl: string;
  project: HarborProject;
  shortName: string;
  artifact: HarborArtifact;
  tag?: string;
  /** Full image reference: `<host>/<project>/<repo>:<tag>` or `…@<digest>`. */
  reference: string;
  pullCommand?: string;
}

export interface MessageNode {
  kind: "message";
  id: string;
  text: string;
  severity: "info" | "warning" | "error";
  detail?: string;
}

export type HarborNode =
  | ConnectionNode
  | SectionNode
  | ProjectNode
  | RepositoryNode
  | ArtifactNode
  | MessageNode;

export class ProjectsProvider implements vscode.TreeDataProvider<HarborNode>, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  /** Host used in image references, resolved when the root is loaded. */
  private registryHostName: string | undefined;
  /** Authentication mode of the connected instance ("db_auth", "oidc_auth"…). */
  private connectedAuthMode: string | undefined;
  private readonly dateFormat = createDateFormat({ dateStyle: "medium" });
  private readonly dateTimeFormat = createDateFormat({ dateStyle: "medium", timeStyle: "short" });

  constructor(
    private readonly session: HarborSession,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  get authMode(): string | undefined {
    return this.connectedAuthMode;
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  async getChildren(element?: HarborNode): Promise<HarborNode[]> {
    const current = this.session.current;
    if (!current) {
      return [];
    }
    const { connection, client } = current;

    switch (element?.kind) {
      case undefined:
        return this.loadRoot();

      case "section":
        return this.load(`section:${element.visibility}`, "Could not load projects", async () => {
          const projects = await client.listProjects(element.visibility);
          if (projects.length === 0) {
            return [message(`section:${element.visibility}`, element.visibility === "public"
              ? "No public projects"
              : "No private projects you can access")];
          }
          return projects.map((project): ProjectNode => ({ kind: "project", baseUrl: connection.url, project }));
        });

      case "project":
        return this.load(`project:${element.project.project_id}`, "Could not load repositories", async () => {
          const repositories = await client.listRepositories(element.project.name);
          if (repositories.length === 0) {
            return [message(`project:${element.project.project_id}`, "No repositories")];
          }
          return repositories.map((repository): RepositoryNode => ({
            kind: "repository",
            baseUrl: element.baseUrl,
            project: element.project,
            repository,
            shortName: repositoryShortName(element.project.name, repository.name),
          }));
        });

      case "repository":
        return this.load(`repository:${element.repository.id}`, "Could not load artifacts", async () => {
          const artifacts = await client.listArtifacts(element.project.name, element.shortName);
          if (artifacts.length === 0) {
            return [message(`repository:${element.repository.id}`, "No artifacts")];
          }
          const host = this.registryHostName ?? registryHost(connection.url);
          const repository = repositoryReference(host, element.repository.name);
          return artifacts.flatMap((artifact) => {
            const tags = artifact.tags?.length ? artifact.tags.map((t) => t.name) : [undefined];
            return tags.map((tag): ArtifactNode => ({
              kind: "artifact",
              baseUrl: element.baseUrl,
              project: element.project,
              shortName: element.shortName,
              artifact,
              tag,
              reference: imageReference(repository, artifact, tag),
              pullCommand: pullCommand(repository, artifact, tag),
            }));
          });
        });

      default:
        return [];
    }
  }

  getTreeItem(node: HarborNode): vscode.TreeItem {
    switch (node.kind) {
      case "connection":
        return this.connectionItem(node);
      case "section":
        return sectionItem(node);
      case "project":
        return projectItem(node);
      case "repository":
        return repositoryItem(node);
      case "artifact":
        return this.artifactItem(node);
      case "message":
        return messageItem(node);
    }
  }

  private async loadRoot(): Promise<HarborNode[]> {
    const current = this.session.current;
    if (!current) {
      return [];
    }
    const { connection, client } = current;
    const host = new URL(connection.url).host;
    return this.load("root", `Could not connect to ${host}`, async () => {
      const { info, credentialsAccepted } = await client.getSystemInfo();
      this.registryHostName = registryHost(connection.url, info.registry_url);
      this.connectedAuthMode = info.auth_mode;

      const root: HarborNode[] = [{
        kind: "connection",
        host,
        username: connection.credentials?.username,
        credentialsAccepted,
        systemInfo: info,
      }];
      if (credentialsAccepted) {
        root.push(
          { kind: "section", visibility: "private", expanded: true },
          { kind: "section", visibility: "public", expanded: false },
        );
      } else {
        if (credentialsAccepted === false) {
          root.push({
            kind: "message",
            id: "root:credentials",
            severity: "warning",
            text: "Saved credentials were rejected",
            detail: "Harbor did not accept the saved username and password, so only public projects are shown. Run \"Harbor Browser: Connect to Registry…\" to sign in again.",
          });
        }
        root.push({ kind: "section", visibility: "public", expanded: true });
      }
      return root;
    });
  }

  /** Runs a loader and turns failures into a visible error node plus a log entry. */
  private async load(
    parentId: string,
    failureText: string,
    loader: () => Promise<HarborNode[]>,
  ): Promise<HarborNode[]> {
    try {
      return await loader();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.log.error(`${failureText}: ${detail}`);
      return [{
        kind: "message",
        id: `${parentId}:error`,
        severity: "error",
        text: failureText,
        detail,
      }];
    }
  }

  private connectionItem(node: ConnectionNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.host, vscode.TreeItemCollapsibleState.None);
    item.id = "connection";
    item.contextValue = "connection";

    const rejected = node.credentialsAccepted === false;
    const identity = node.username ?? "anonymous";
    item.description = rejected ? `${identity} — sign-in failed` : identity;
    item.iconPath = rejected
      ? new vscode.ThemeIcon("warning", new vscode.ThemeColor("list.warningForeground"))
      : new vscode.ThemeIcon("server");

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown("**Registry:** ").appendText(node.host).appendMarkdown("  \n");
    if (node.systemInfo.harbor_version) {
      tooltip.appendMarkdown("**Harbor version:** ").appendText(node.systemInfo.harbor_version).appendMarkdown("  \n");
    }
    tooltip.appendMarkdown("**Signed in as:** ").appendText(node.username ? identity : "anonymous (public projects only)");
    if (rejected) {
      tooltip.appendMarkdown("\n\n$(warning) Harbor rejected the saved credentials.");
      tooltip.supportThemeIcons = true;
    }
    item.tooltip = tooltip;
    return item;
  }

  private artifactItem(node: ArtifactNode): vscode.TreeItem {
    const { artifact, tag } = node;
    const item = new vscode.TreeItem(tag ?? shortDigest(artifact.digest), vscode.TreeItemCollapsibleState.None);
    item.id = `artifact:${artifact.id}:${tag ?? "@untagged"}`;

    const scan = scanState(artifact);
    const contextFlags = [
      node.pullCommand ? "pullable" : undefined,
      scan.kind === "done" ? "scanned" : undefined,
    ].filter(Boolean);
    item.contextValue = ["artifact", ...contextFlags].join(":");
    item.iconPath = new vscode.ThemeIcon(
      tag ? "tag" : "circle-outline",
      scan.kind === "done" ? severityColor(scan.severity) : undefined,
    );

    item.description = [
      tag ? undefined : "untagged",
      artifact.type && artifact.type !== "IMAGE" ? artifact.type.toLowerCase() : undefined,
      scanDescription(scan),
      this.formatDate(artifact.push_time, this.dateFormat),
      formatBytes(artifact.size),
    ].filter(Boolean).join(" · ");

    const tooltip = new vscode.MarkdownString();
    tooltip.appendCodeblock(node.reference, "text");
    tooltip.appendMarkdown("**Type:** ").appendText(artifact.type || "unknown").appendMarkdown("  \n");
    if (artifact.type === "IMAGE" || scan.kind !== "notScanned") {
      tooltip.appendMarkdown("**Vulnerabilities:** ").appendText(this.describeScan(scan)).appendMarkdown("  \n");
    }
    tooltip.appendMarkdown("**Digest:** ").appendText(artifact.digest).appendMarkdown("  \n");
    tooltip.appendMarkdown("**Size:** ").appendText(formatBytes(artifact.size)).appendMarkdown("  \n");
    const pushed = this.formatDate(artifact.push_time, this.dateTimeFormat);
    if (pushed) {
      tooltip.appendMarkdown("**Pushed:** ").appendText(pushed).appendMarkdown("  \n");
    }
    const pulled = this.formatDate(artifact.pull_time, this.dateTimeFormat);
    if (pulled) {
      tooltip.appendMarkdown("**Last pulled:** ").appendText(pulled);
    }
    item.tooltip = tooltip;
    return item;
  }

  private describeScan(scan: ScanState): string {
    switch (scan.kind) {
      case "notScanned":
        return "not scanned";
      case "done": {
        const scanner = [scan.summary.scanner?.name, scan.summary.scanner?.version].filter(Boolean).join(" ");
        const scanned = this.formatDate(scan.summary.end_time, this.dateTimeFormat);
        const details = [scanner && `by ${scanner}`, scanned && `on ${scanned}`].filter(Boolean).join(" ");
        return `${vulnerabilityCounts(scan.summary)}${details ? ` (scanned ${details})` : ""}`;
      }
      default:
        return scanDescription(scan) ?? "unknown";
    }
  }

  private formatDate(value: string | undefined, format: Intl.DateTimeFormat): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    // Harbor reports "0001-01-01T00:00:00.000Z" for artifacts that were never pulled.
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1970) {
      return undefined;
    }
    return format.format(date);
  }
}

/** Colors follow the Harbor portal: red, orange, yellow, blue and green. */
function severityColor(severity: Severity): vscode.ThemeColor | undefined {
  switch (severity) {
    case "Critical":
      return new vscode.ThemeColor("charts.red");
    case "High":
      return new vscode.ThemeColor("charts.orange");
    case "Medium":
      return new vscode.ThemeColor("charts.yellow");
    case "Low":
    case "Negligible":
      return new vscode.ThemeColor("charts.blue");
    case "None":
      return new vscode.ThemeColor("charts.green");
    default:
      return undefined;
  }
}

function message(parentId: string, text: string): MessageNode {
  return { kind: "message", id: `${parentId}:message`, severity: "info", text };
}

function sectionItem(node: SectionNode): vscode.TreeItem {
  const isPublic = node.visibility === "public";
  const item = new vscode.TreeItem(
    isPublic ? "Public Projects" : "Private Projects",
    node.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
  );
  item.id = `section:${node.visibility}`;
  item.contextValue = "section";
  item.iconPath = new vscode.ThemeIcon(isPublic ? "globe" : "lock");
  item.tooltip = isPublic
    ? "Projects anyone can pull from"
    : "Private projects you are a member of (all private projects for administrators)";
  return item;
}

function projectItem(node: ProjectNode): vscode.TreeItem {
  const { project } = node;
  const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
  item.id = `project:${project.project_id}`;
  item.contextValue = "project";
  // Regular projects report no registry or a registry_id of 0.
  const isProxyCache = (project.registry_id ?? 0) > 0;
  const repositories = project.repo_count === undefined
    ? undefined
    : pluralize(project.repo_count, "repository", "repositories");
  item.description = [isProxyCache ? "proxy cache" : undefined, repositories].filter(Boolean).join(" · ");
  item.iconPath = new vscode.ThemeIcon(isProxyCache ? "cloud" : "folder");

  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown("**Project:** ").appendText(project.name).appendMarkdown("  \n");
  tooltip.appendMarkdown("**Visibility:** ").appendText(project.metadata?.public === "true" ? "public" : "private");
  if (isProxyCache) {
    tooltip.appendMarkdown("  \n**Proxy cache:** images are pulled through from an upstream registry");
  }
  item.tooltip = tooltip;
  return item;
}

function repositoryItem(node: RepositoryNode): vscode.TreeItem {
  const { repository } = node;
  const item = new vscode.TreeItem(node.shortName, vscode.TreeItemCollapsibleState.Collapsed);
  item.id = `repository:${repository.id}`;
  item.contextValue = "repository";
  item.iconPath = new vscode.ThemeIcon("package");
  if (repository.artifact_count !== undefined) {
    item.description = pluralize(repository.artifact_count, "artifact", "artifacts");
  }

  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown("**Repository:** ").appendText(repository.name);
  if (repository.pull_count !== undefined) {
    tooltip.appendMarkdown("  \n**Pulls:** ").appendText(String(repository.pull_count));
  }
  if (repository.description) {
    // Harbor repository descriptions are Markdown. The string is not trusted,
    // so command links and HTML are not rendered.
    tooltip.appendMarkdown("\n\n---\n\n").appendMarkdown(repository.description);
  }
  item.tooltip = tooltip;
  return item;
}

function messageItem(node: MessageNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.text, vscode.TreeItemCollapsibleState.None);
  item.id = node.id;
  item.contextValue = "message";
  if (node.severity === "error") {
    item.description = node.detail;
  }
  item.tooltip = node.detail;
  item.iconPath = node.severity === "info"
    ? new vscode.ThemeIcon("info")
    : new vscode.ThemeIcon(node.severity, new vscode.ThemeColor(
      node.severity === "error" ? "list.errorForeground" : "list.warningForeground",
    ));
  return item;
}

/** Formats dates in the VS Code display language. */
function createDateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(vscode.env.language, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}
