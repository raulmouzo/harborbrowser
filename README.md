# HarborBrowser

Browse Docker images from a [Harbor](https://goharbor.io/) registry directly in VS Code.

## Features

- Browse public repositories without authentication
- Browse private repositories after logging in
- Credentials stored securely in the system keychain

## Getting Started

### Browsing public projects

No configuration needed. Public projects are listed automatically in the sidebar.

### Logging in to access private projects

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Run **Harbor Browser: Login**
3. Enter your Harbor URL (e.g. `https://harbor.example.com`)
4. Enter your username
5. Enter your password or CLI secret

Your credentials are stored securely using the VS Code secret storage (system keychain). The next time you run the login command, the URL and username will be pre-filled.

> **Note:** To get your CLI secret, go to your Harbor profile → User Profile → CLI secret.

## Requirements

Access to a Harbor registry instance (v2.0 or later).

## Known Issues

None yet.

## Release Notes

### 0.0.1

Initial release.
