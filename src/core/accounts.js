/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 *
 * UI-agnostic account operations shared by the CLI and the desktop app.
 */

const path = require("path");
const fs = require("fs-extra");
const simpleGit = require("simple-git");
const { SSH_DIR } = require("../utils/paths");
const { generateKey } = require("../ssh/keygen");
const { addKeyToAgent } = require("../ssh/agent");
const { addHostToConfig, removeHostFromConfig } = require("../ssh/config");
const { checkConnection } = require("../ssh/testConnection");
const { loadConfig } = require("../config/loadConfig");
const { saveConfig } = require("../config/saveConfig");

const SUFFIX_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

async function listAccounts() {
  const config = await loadConfig();
  return config.accounts;
}

async function getAccount(id) {
  const account = (await listAccounts()).find((a) => a.id === id);
  if (!account) throw new Error(`Account '${id}' not found.`);
  return account;
}

// Paths an account would use; the first account gets the default github.com key
function accountPaths(isFirst, suffix) {
  if (isFirst) {
    return {
      id: "default",
      keyPath: path.join(SSH_DIR, "id_ed25519"),
      sshHost: "github.com",
    };
  }
  return {
    id: suffix,
    keyPath: path.join(SSH_DIR, `id_ed25519_${suffix}`),
    sshHost: `github.com-${suffix}`,
  };
}

/**
 * Creates the SSH key, ssh-agent entry, SSH host alias and config entry.
 * Returns the saved account, its public key and any non-fatal warnings.
 */
async function createAccount({
  username,
  email,
  name = "",
  suffix = "",
  passphrase = "",
  overwriteKey = false,
}) {
  username = (username || "").trim();
  email = (email || "").trim();
  name = (name || "").trim();
  suffix = (suffix || "").trim().toLowerCase();

  if (!username) throw new Error("GitHub username is required.");
  if (!email) throw new Error("Email is required.");

  const config = await loadConfig();
  const isFirst = config.accounts.length === 0;

  if (!isFirst) {
    if (!SUFFIX_PATTERN.test(suffix)) {
      throw new Error(
        "Account label must use lowercase letters, numbers, '-' or '_'."
      );
    }
    if (config.accounts.some((a) => a.id === suffix)) {
      throw new Error(`An account labelled '${suffix}' already exists.`);
    }
  }

  const { id, keyPath, sshHost } = accountPaths(isFirst, suffix);
  const warnings = [];
  let keyGenerated = false;
  let reusedKey = false;

  try {
    if (await fs.pathExists(keyPath)) {
      if (overwriteKey) {
        await fs.remove(keyPath);
        await fs.remove(`${keyPath}.pub`);
      } else {
        reusedKey = true;
      }
    }
    if (!reusedKey) {
      await generateKey(keyPath, email, passphrase);
      keyGenerated = true;
    }

    if (!(await addKeyToAgent(keyPath, passphrase))) {
      warnings.push(
        "Could not add the key to ssh-agent. Make sure ssh-agent is running."
      );
    }
    await addHostToConfig(sshHost, keyPath);

    if (isFirst && name) {
      try {
        const git = simpleGit();
        await git.addConfig("user.name", name, false, "global");
        await git.addConfig("user.email", email, false, "global");
      } catch (error) {
        warnings.push(
          error.message.includes("ENOENT")
            ? "Git was not found. Install Git and make sure it is in your PATH."
            : `Failed to set global git config: ${error.message}`
        );
      }
    }

    const account = { id, username, sshHost, sshKey: keyPath, email };
    if (isFirst && name) account.name = name;

    config.accounts.push(account);
    await saveConfig(config);

    const publicKey = (await fs.readFile(`${keyPath}.pub`, "utf8")).trim();
    return { account, publicKey, reusedKey, warnings, isFirst };
  } catch (error) {
    if (keyGenerated) {
      await fs.remove(keyPath).catch(() => {});
      await fs.remove(`${keyPath}.pub`).catch(() => {});
    }
    throw error;
  }
}

async function getPublicKey(id) {
  const account = await getAccount(id);
  return (await fs.readFile(`${account.sshKey}.pub`, "utf8")).trim();
}

async function removeAccount(id, { deleteKey = false } = {}) {
  const config = await loadConfig();
  const account = config.accounts.find((a) => a.id === id);
  if (!account) throw new Error(`Account '${id}' not found.`);

  config.accounts = config.accounts.filter((a) => a.id !== id);
  await saveConfig(config);

  const warnings = [];
  try {
    await removeHostFromConfig(account.sshHost);
  } catch (error) {
    warnings.push(error.message);
  }

  let keyDeleted = false;
  if (deleteKey && account.sshKey && (await fs.pathExists(account.sshKey))) {
    await fs.remove(account.sshKey);
    await fs.remove(`${account.sshKey}.pub`);
    keyDeleted = true;
  }

  return { account, keyDeleted, warnings };
}

async function updateAccount(id, changes) {
  const config = await loadConfig();
  const account = config.accounts.find((a) => a.id === id);
  if (!account) throw new Error(`Account '${id}' not found.`);
  Object.assign(account, changes);
  await saveConfig(config);
  return account;
}

async function verifyAccount(id, options) {
  const account = await getAccount(id);
  return checkConnection(account.sshHost, options);
}

module.exports = {
  listAccounts,
  getAccount,
  accountPaths,
  createAccount,
  getPublicKey,
  removeAccount,
  updateAccount,
  verifyAccount,
};
