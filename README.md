# Harbor Browser

Browse a [Harbor](https://goharbor.io/) container registry from the sidebar of VS Code, VSCodium and other compatible editors. Explore projects, repositories and artifacts, then copy an image reference or a ready-to-run pull command without opening the Harbor web portal.

## Features

- **Projects, repositories and artifacts in a tree**: private projects you belong to and public projects, with nested repositories (`team/apps/api`), proxy cache projects, tags and untagged artifacts.
- **Copy image reference**: `registry.example.com/library/nginx:1.27`, or `…@sha256:…` for untagged artifacts.
- **Copy pull command** that matches the artifact type, the same way the Harbor portal does:
  - container images: `docker pull …`
  - Helm charts: `helm pull oci://… --version …`
  - CNAB bundles: `cnab-to-oci pull …`
- **Open in Harbor**: jump to the project, repository or artifact page in the web portal.
- **Any account type**: user accounts (database or LDAP), OIDC users with their CLI secret, robot accounts, or anonymous access to public projects.
- **Credentials checked before they are saved**, and kept in the operating system keychain through VS Code's secret storage.
- **Platforms at a glance**: multi-platform images (image indexes) list the platforms they support, such as `amd64, arm64/v8`, so you can check ARM support before deploying.
- Push date, size and type of every artifact, with more details on hover.

## Requirements

- VS Code 1.96 or later, or a compatible editor such as VSCodium.
- A Harbor 2.x instance reachable from your machine.

## Installation

- **VS Code**: search for **Harbor Browser** in the Extensions view, or run `ext install raulmouzo.harborbrowser` from the Quick Open (`Ctrl+P` / `Cmd+P`) box. The extension is published on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=raulmouzo.harborbrowser).
- **VSCodium and other editors that use Open VSX**: search for **Harbor Browser** in the Extensions view, or download it from [Open VSX](https://open-vsx.org/extension/raulmouzo/harborbrowser).

## Getting started

1. Open the **Harbor Browser** view from the Activity Bar.
2. Select **Connect to Registry** (or run **Harbor Browser: Connect to Registry…** from the Command Palette).
3. Enter the address of your Harbor instance, for example `https://harbor.example.com`. You can also paste any URL copied from the Harbor portal.
4. Choose how to connect:

   | Option | Use it when | What to enter |
   | --- | --- | --- |
   | **Sign in** with a user account | Harbor uses database or LDAP authentication | Your username and password |
   | **Sign in** with OIDC | Harbor shows a "Login with *provider*" button | Your Harbor username and your **CLI secret** (Harbor web portal → your user profile → CLI secret). Your OIDC password does not work here. |
   | **Sign in** with a robot account | Shared machines, read-only access | The full robot name, for example `robot$project+ci`, and its secret |
   | **Browse anonymously** | You only need public projects | Nothing else |

Harbor Browser checks the connection and the credentials before saving them. Once connected, the view shows your private and public projects. Expand a project, then a repository, to see its artifacts.

## Working with artifacts

Right-click an artifact, or use the buttons that appear on hover:

| Action | Result |
| --- | --- |
| **Copy Image Reference** | Copies `<registry>/<project>/<repository>:<tag>` or `…@<digest>` |
| **Copy Pull Command** | Copies the pull command for the artifact type (images, Helm charts and CNAB bundles) |
| **Open in Harbor** | Opens the artifact in the Harbor web portal |

Image references use the registry address reported by Harbor, which can differ from the address you connected to when Harbor sits behind a proxy or load balancer.

## Commands

| Command | Description |
| --- | --- |
| `Harbor Browser: Connect to Registry…` | Connect to a Harbor instance, or switch to another one or another account |
| `Harbor Browser: Disconnect` | Forget the saved registry and credentials |
| `Harbor Browser: Refresh` | Reload the tree |
| `Harbor Browser: Show Logs` | Open the extension's output channel |

## Security and privacy

- The registry address and credentials are stored with VS Code's [secret storage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage), which uses the operating system keychain. They are never written to settings files.
- Harbor Browser only talks to the Harbor instance you connect to, through the Harbor REST API, and only reads data. It collects no telemetry.
- Credentials are sent with HTTP Basic authentication, which is the only authentication method the Harbor API accepts. Use `https://` addresses so that they are encrypted in transit. A robot account with pull permissions is a good choice when you only need to browse.

## Troubleshooting

**Certificate errors (self-signed or internal CA).** VS Code uses the operating system certificate store. Add your Harbor CA certificate to it, as described in [Network connections in VS Code](https://code.visualstudio.com/docs/setup/network#_ssl-certificates), then restart the editor.

**"Saved credentials were rejected".** The password, CLI secret or robot secret changed, or the robot account expired. Run **Connect to Registry…** again. Until then, only public projects are shown, because Harbor treats requests with invalid credentials as anonymous.

**OIDC users cannot sign in.** Use the CLI secret from your Harbor user profile instead of your OIDC password. The CLI secret stops working when Harbor can no longer refresh your OIDC session. Log in to the Harbor web portal again to renew it.

**Something else.** Run **Harbor Browser: Show Logs**. Every failed request is logged with the reason returned by Harbor.

## Known limitations

- **Open in Harbor** opens the project page for repositories whose name contains a slash (for example `team/apps/api`). The VS Code API always decodes the `%2F` that the Harbor portal needs in these links.
- The extension is read-only: it does not push, delete, retag or scan artifacts.

## Development

Requires Node.js 22.13 or later and pnpm 12. Run `corepack enable` or install pnpm; the version is pinned in `package.json`.

```sh
pnpm install
pnpm run compile        # type-check, lint and bundle into dist/
pnpm test               # compile and run the test suite in VS Code
pnpm run package-vsix   # build harborbrowser-<version>.vsix
```

Press `F5` in VS Code to start an Extension Development Host with the extension loaded.

## License

[MIT](LICENSE)
