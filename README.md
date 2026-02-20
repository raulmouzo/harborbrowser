# Harbor Browser

Browse your [Harbor](https://goharbor.io/) container registry directly from VS Code — explore projects, repositories, and image tags without leaving your editor.

## Features

- **Browse public projects** without any configuration
- **Browse private projects** after logging in with your credentials
- Navigate the full registry hierarchy: **Project → Repository → Image tag**
- See each tag's **push date and size** at a glance
- **Copy image name** or **`docker pull` command** to clipboard with one click
- **Open any project, repository, or artifact** in the Harbor web UI

## Getting Started

### Browsing public projects

Open the Harbor Browser panel from the activity bar. Public projects load automatically — no configuration needed.

### Logging in to access private projects

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Run **Harbor Browser: Login**
3. Enter your Harbor registry URL (e.g. `https://harbor.example.com`)
4. Enter your username
5. Enter your password or CLI secret
