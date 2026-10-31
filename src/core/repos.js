/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 *
 * UI-agnostic repository sync shared by the CLI and the desktop app.
 */

const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const simpleGit = require("simple-git");
const { fetchRepos } = require("../repos/fetchRepos");

function resolveBaseDir(baseDir) {
  if (baseDir.startsWith("~")) {
    return path.join(os.homedir(), baseDir.slice(1));
  }
  return baseDir;
}

// Another repo with the same name may already live in baseDir (e.g. a fork from
// a different owner); those get cloned into "<name>+<owner>" instead.
async function resolveTargetFolder(baseDir, repo) {
  const potentialPath = path.join(baseDir, repo.name);
  let isConflict = false;

  if (await fs.pathExists(potentialPath)) {
    if (await fs.pathExists(path.join(potentialPath, ".git"))) {
      try {
        const git = simpleGit(potentialPath);
        const remotes = await git.getRemotes(true);
        const origin = remotes.find((r) => r.name === "origin");

        if (!origin || !origin.refs.fetch.includes(repo.full_name)) {
          isConflict = true;
        }
      } catch (e) {
        isConflict = true;
      }
    } else {
      isConflict = true;
    }
  }

  return isConflict ? `${repo.name}+${repo.owner.login}` : repo.name;
}

async function syncRepo(account, repo, baseDir) {
  const folderName = await resolveTargetFolder(baseDir, repo);
  const targetPath = path.join(baseDir, folderName);

  let cloneUrl = repo.ssh_url;
  if (account.sshHost !== "github.com") {
    cloneUrl = cloneUrl.replace("github.com", account.sshHost);
  }

  let action;
  if (await fs.pathExists(targetPath)) {
    const git = simpleGit(targetPath);

    await git.remote(["set-url", "origin", cloneUrl]);
    await git.fetch("origin", ["+refs/heads/*:refs/remotes/origin/*"]);
    await git.fetch(["--tags"]);
    await git.pull();
    action = "updated";
  } else {
    await simpleGit().clone(cloneUrl, targetPath);
    const git = simpleGit(targetPath);
    await git.fetch(["--tags"]);
    action = "cloned";
  }

  if (await fs.pathExists(path.join(targetPath, ".git"))) {
    const git = simpleGit(targetPath);
    await git.addConfig("user.name", account.username);
    await git.addConfig("user.email", account.email);
  }

  return { folderName, action };
}

/**
 * Clones or updates each repo into baseDir, reporting progress through
 * onProgress({ repo, folderName, status: "syncing" | "cloned" | "updated" | "failed", error }).
 */
async function syncRepos({ account, repos, baseDir, onProgress = () => {} }) {
  baseDir = resolveBaseDir(baseDir);
  await fs.ensureDir(baseDir);

  const results = [];
  for (const repo of repos) {
    onProgress({ repo: repo.full_name, status: "syncing" });
    try {
      const { folderName, action } = await syncRepo(account, repo, baseDir);
      const result = { repo: repo.full_name, folderName, status: action };
      results.push(result);
      onProgress(result);
    } catch (error) {
      const result = {
        repo: repo.full_name,
        status: "failed",
        error: error.message,
      };
      results.push(result);
      onProgress(result);
    }
  }
  return results;
}

module.exports = { fetchRepos, syncRepos, syncRepo, resolveBaseDir };
