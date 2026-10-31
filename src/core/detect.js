/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 *
 * Finds GitHub SSH setups that already exist on this machine (made by hand or
 * other tools) so they can be imported instead of recreated.
 */

const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const simpleGit = require("simple-git");
const { SSH_DIR, HOME_DIR } = require("../utils/paths");
const { checkConnection } = require("../ssh/testConnection");
const { loadConfig } = require("../config/loadConfig");
const { saveConfig } = require("../config/saveConfig");
const { removeHostFromConfig } = require("../ssh/config");

const DEFAULT_KEYS = ["id_ed25519", "id_ecdsa", "id_rsa"];
const LABEL_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function expandHome(p) {
  return p.replace(/^~(?=$|[\\/])/, HOME_DIR).replace(/^"|"$/g, "");
}

// Minimal ssh_config parser: returns Host blocks with lower-cased option keys
function parseSshConfig(content) {
  const blocks = [];
  let current = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(\S+)\s*=?\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "host") {
      current = { patterns: value.split(/\s+/), options: {} };
      blocks.push(current);
    } else if (key === "match") {
      current = null;
    } else if (current && !(key in current.options)) {
      current.options[key] = value;
    }
  }
  return blocks;
}

async function readSshConfig() {
  const file = path.join(SSH_DIR, "config");
  if (!(await fs.pathExists(file))) return [];
  return parseSshConfig(await fs.readFile(file, "utf8"));
}

async function readPublicKeyComment(keyPath) {
  try {
    const parts = (await fs.readFile(`${keyPath}.pub`, "utf8"))
      .trim()
      .split(/\s+/);
    return parts.slice(2).join(" ");
  } catch {
    return "";
  }
}

async function globalGitIdentity() {
  try {
    const git = simpleGit();
    const name = await git.getConfig("user.name", "global");
    const email = await git.getConfig("user.email", "global");
    return { name: name.value || "", email: email.value || "" };
  } catch {
    return { name: "", email: "" };
  }
}

// Username logged in with the GitHub CLI, if any
async function ghCliUser() {
  const dirs = [
    process.env.GH_CONFIG_DIR,
    process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, "gh"),
    path.join(HOME_DIR, ".config", "gh"),
    process.env.APPDATA && path.join(process.env.APPDATA, "GitHub CLI"),
  ].filter(Boolean);
  for (const dir of dirs) {
    try {
      const yml = await fs.readFile(path.join(dir, "hosts.yml"), "utf8");
      const block = yml.split(/^github\.com:\s*$/m)[1];
      const user = block && block.match(/^\s+user:\s*(\S+)/m);
      if (user) return user[1];
    } catch {
      // not installed or not logged in
    }
  }
  return "";
}

function labelFor(host) {
  if (host === "github.com") return "default";
  const label = host
    .replace(/^github\.com[-_.]?/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return label || "github";
}

/**
 * Lists GitHub hosts found in ~/.ssh/config plus a default key used for plain
 * github.com, skipping hosts GHX already manages. With `probe`, each host is
 * tested over SSH, which also tells us the GitHub username behind the key.
 */
async function detectAccounts({ probe = true } = {}) {
  const config = await loadConfig();
  const managed = new Set(config.accounts.map((a) => a.sshHost));
  const candidates = [];

  for (const block of await readSshConfig()) {
    const hostname = (block.options.hostname || "").toLowerCase();
    for (const host of block.patterns) {
      if (/[*?!]/.test(host)) continue;
      const isGithub =
        hostname === "github.com" ||
        hostname === "ssh.github.com" ||
        (!hostname && host.toLowerCase() === "github.com");
      if (!isGithub || managed.has(host)) continue;

      const identity = block.options.identityfile;
      const keyPath = identity ? expandHome(identity) : null;
      // Several aliases for the same key are the same GitHub account
      const sameKey = keyPath && candidates.find((c) => c.keyPath === keyPath);
      if (sameKey) {
        sameKey.aliases.push(host);
        continue;
      }
      if (candidates.some((c) => c.sshHost === host)) continue;
      candidates.push({
        sshHost: host,
        keyPath,
        source: "ssh-config",
        aliases: [host],
      });
    }
  }

  // Plain github.com works without any config if a default key exists
  if (
    !managed.has("github.com") &&
    !candidates.some((c) => c.sshHost === "github.com")
  ) {
    for (const name of DEFAULT_KEYS) {
      const keyPath = path.join(SSH_DIR, name);
      if (await fs.pathExists(keyPath)) {
        candidates.push({
          sshHost: "github.com",
          keyPath,
          source: "default-key",
          aliases: [],
        });
        break;
      }
    }
  }

  const [identity, ghUser] = await Promise.all([
    globalGitIdentity(),
    ghCliUser(),
  ]);
  const usedLabels = new Set(config.accounts.map((a) => a.id));

  const results = await Promise.all(
    candidates.map(async (c) => {
      const keyExists = c.keyPath ? await fs.pathExists(c.keyPath) : false;
      const comment = c.keyPath ? await readPublicKeyComment(c.keyPath) : "";

      let username = "";
      let authenticated = false;
      let message = "";
      if (probe) {
        const res = await checkConnection(c.sshHost, { batch: true });
        authenticated = res.ok;
        message = res.message;
        const hi = res.message.match(/Hi ([A-Za-z0-9-]+)!/);
        if (hi) username = hi[1];
      }

      let label = labelFor(c.sshHost);
      for (let n = 2; usedLabels.has(label); n++)
        label = `${labelFor(c.sshHost)}-${n}`;
      usedLabels.add(label);

      return {
        ...c,
        keyExists,
        authenticated,
        message,
        username: username || (c.sshHost === "github.com" ? ghUser : ""),
        email: comment.includes("@") ? comment : identity.email,
        name: c.sshHost === "github.com" ? identity.name : "",
        label,
      };
    })
  );

  // Verified accounts first; github.com wins when aliases resolve to the same user
  results.sort(
    (a, b) =>
      b.authenticated - a.authenticated ||
      (b.sshHost === "github.com") - (a.sshHost === "github.com")
  );
  const seenUsers = new Set();
  return results.filter((r) => {
    if (!r.authenticated || !r.username) return true;
    if (seenUsers.has(r.username)) return false;
    seenUsers.add(r.username);
    return true;
  });
}

/**
 * Deletes a GitHub setup GHX doesn't manage: its Host aliases are removed from
 * ~/.ssh/config and, if asked, its key files are deleted.
 */
async function removeDetected({ aliases = [], keyPath, deleteKey = false }) {
  const config = await loadConfig();
  const managed = new Set(config.accounts.map((a) => a.sshHost));
  if (aliases.some((h) => managed.has(h))) {
    throw new Error("This host is managed by GHX. Remove it from Accounts.");
  }

  const removedHosts = [];
  for (const host of aliases) {
    if (await removeHostFromConfig(host)) removedHosts.push(host);
  }

  let keyDeleted = false;
  if (deleteKey && keyPath) {
    const usedBy = config.accounts.find((a) => a.sshKey === keyPath);
    if (usedBy) {
      throw new Error(
        `The key is still used by GHX account '${usedBy.id}', so it was kept.`
      );
    }
    if (await fs.pathExists(keyPath)) {
      await fs.remove(keyPath);
      await fs.remove(`${keyPath}.pub`);
      keyDeleted = true;
    }
  }

  return { removedHosts, keyDeleted };
}

/** Adds an existing SSH setup to GHX without touching keys or ~/.ssh/config. */
async function importAccount({
  sshHost,
  keyPath,
  username,
  email,
  name,
  label,
}) {
  username = (username || "").trim();
  email = (email || "").trim();
  label = (label || "").trim().toLowerCase();

  if (!sshHost) throw new Error("Missing SSH host.");
  if (!username) throw new Error("GitHub username is required.");
  if (!email) throw new Error("Email is required.");
  if (!LABEL_PATTERN.test(label)) {
    throw new Error(
      "Account label must use lowercase letters, numbers, '-' or '_'."
    );
  }

  const config = await loadConfig();
  if (config.accounts.some((a) => a.sshHost === sshHost)) {
    throw new Error(`${sshHost} is already managed by GHX.`);
  }
  if (config.accounts.some((a) => a.id === label)) {
    throw new Error(`An account labelled '${label}' already exists.`);
  }

  const account = {
    id: label,
    username,
    sshHost,
    sshKey: keyPath || path.join(os.homedir(), ".ssh", "id_ed25519"),
    email,
    imported: true,
  };
  if (name) account.name = name.trim();

  config.accounts.push(account);
  await saveConfig(config);
  return account;
}

module.exports = {
  detectAccounts,
  importAccount,
  removeDetected,
  parseSshConfig,
};
