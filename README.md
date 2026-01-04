# 🚀 GHX – GitHub Account Manager

> **Manage multiple GitHub accounts, SSH keys, and repositories effortlessly.**

**GHX** is a powerful CLI designed to solve the pain of switching between Work, Personal, and Client GitHub accounts. It handles SSH keys, Git configs, and repo syncing automatically—so you never commit with the wrong email again.

---

## ✨ Features

- **🔑 Multi-Account Management**: Seamlessly switch between accounts. Each gets a dedicated, isolated SSH key.
- **🛡️ Security First**:
  - Supports **SSH Passphrases**.
  - **Connection Checks**: Verifies internet before generating keys.
  - **Safe Conflict Handling**: Never blindly overwrites existing keys.
- **⚡ Smart Repository Sync**:
  - **Fetch ALL Repos**: Pagination support to find _every_ repo you have access to.
  - **Zero Conflicts**: Automatically renames folders (`repo+username`) if naming collisions occur.
  - **Full Git Sync**: Runs `remote set-url`, `fetch tags`, and `pull` in one go.
- **🤖 Automation**:
  - **Auto-Config**: Sets `user.name` and `user.email` locally for every cloned repo.
  - **Host Verification**: Auto-accepts valid GitHub host keys to prevent prompts.
- **✅ Verification Tools**:
  - **Validate Connections**: Test your SSH access instantly from the menu.
  - **Self-Healing**: Tools to clean up invalid keys and configs.

---

## 📦 Installation

### Windows (PowerShell)

```powershell
irm https://github.com/purshottam-jain24/ghx/releases/latest/download/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://github.com/purshottam-jain24/ghx/releases/latest/download/install.sh | bash
```

### Install from Source

```bash
git clone https://github.com/purshottam-jain24/ghx.git
cd ghx
npm install
npm link
```

---

## 🚀 Usage

Simply run `ghx` to start:

```bash
ghx
```

### 📋 Menu Options

1.  **Setup GitHub (first time)**
    - Configures your **primary** account and global identity.

2.  **Add another GitHub account**
    - Adds secondary accounts (e.g., Work). Isolate keys and aliases automatically.

3.  **List all accounts**
    - View all configured accounts and their SSH aliases.

4.  **Verify an account connection**
    - Test SSH connectivity to GitHub for any account.

5.  **Remove an account**
    - Safely delete an account, its keys, and config entries.

6.  **Pull repositories**
    - The ultimate sync tool. Fetches **everything** (owned, collaborated, orgs).
    - Handles naming conflicts and ensures Git is up to date.

---

## ⚙️ Technical Details

- **Config**: `~/.ghx/config.json`
- **SSH Keys**: `~/.ssh/` (Ed25519)
- **SSH Config**: `~/.ssh/config` (Additive updates only)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC © **Purshottam Jain**
