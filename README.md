# 🚀 GHX - GitHub Account Manager

GHX is a CLI tool designed to solve the pain of managing multiple GitHub accounts, SSH keys, and repositories without conflicts.

## Features

- **Multi-Account Support**: Seamlessly switch between Work, Personal, and Freelance accounts.
- **SSH Automation**: Auto-generates keys (`id_ed25519_suffix`), updates `~/.ssh/config` safely (additive only).
- **Global Identity Protection**: Forces global git config for the primary account only, preventing accidental commits with the wrong email.
- **Smart Repo Sync**: Pulls all your repos at once, handling naming conflicts automatically.
- **Zero Breakage**: Never overwrites your existing SSH config or Git config blindly.

## Installation

### Windows (PowerShell)

```powershell
irm https://github.com/purshottam-jain24/ghx/releases/latest/download/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://github.com/purshottam-jain24/ghx/releases/latest/download/install.sh | bash
```

### npm

```bash
npm install -g @purshottam-jain24/ghx
```

### pnpm

```bash
pnpm add -g @purshottam-jain24/ghx
```

## Updates

To update GHX to the latest version, simply run the installation command again. It will overwrite the existing binary with the latest one.

## Usage

Just run `ghx` to start the interactive menu:

```bash
ghx
```

### Menu Options

1.  **Setup GitHub (first time)**: Sets up your primary account and global git config.
2.  **Add another GitHub account**: Adds a secondary account with a custom SSH host suffix (e.g., `github.com-work`).
3.  **Pull repositories**: Fetches and pulls all repositories for a selected account using the GitHub API.

## Directory Structure

- `~/.ghx/config.json`: Stores your account map.
- `~/.ssh/`: Stores generated keys and config.

## License

ISC
