# Changelog

## [1.1.0] - 2026-10-04

### Added

- Browse public projects anonymously, without credentials.
- Credentials are verified before they are saved, for user accounts, OIDC CLI secrets and robot accounts.
- A warning in the tree when the saved credentials are no longer accepted.
- Pull commands for Helm charts (`helm pull oci://…`) and CNAB bundles, matching the Harbor portal.
- `harborbrowser.pullCommand.client` setting to copy `podman pull` commands for container images instead of `docker pull`.
- Proxy cache projects are marked in the tree.
- Errors are shown in the tree, and details are logged to the new **Harbor Browser: Show Logs** output channel.
- Marketplace icon, and support for Restricted Mode and virtual workspaces.

### Changed

- Requires VS Code 1.96 or later, which also widens compatibility with VSCodium and other editors.
- Commands are grouped under the **Harbor Browser** category. Commands that need a tree item no longer appear in the Command Palette.
- Image references use the registry address reported by Harbor.
- Copy actions confirm in the status bar instead of showing a notification.
- The saved connection is stored as a single secret and stays in sync across windows. Connections saved by 1.0.0 are migrated automatically.

### Fixed

- Projects, repositories and artifacts beyond the first 100 were not listed.
- Artifacts of repositories whose name contains a slash failed to load.
- Wrong credentials were saved without warning, and private projects then silently disappeared.
- **Open in Browser** opened a wrong page for repositories whose name contains a slash.

## [1.0.0] - 2026-02-20

### Added

- Browse public and private Harbor projects from the activity bar sidebar
- Navigate the full registry hierarchy: Project → Repository → Image tag
- Display push date and size for each image tag
- Copy image name or `docker pull` command to clipboard
- Open projects, repositories, and artifacts in the Harbor web UI
- Refresh button in the panel title bar
- Collapse all button in the panel title bar
- Credentials stored securely using VS Code Secret Storage (system keychain)
- Welcome view with login button when no credentials are configured
- Connected registry host displayed in the panel
