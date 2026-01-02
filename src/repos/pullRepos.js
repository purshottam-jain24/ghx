const fs = require("fs-extra");
const path = require("path");
const simpleGit = require("simple-git");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { fetchRepos, getGithubToken } = require("./fetchRepos");
const { loadConfig } = require("../config/loadConfig");
const ora = require("ora");

async function pullRepos() {
  const config = await loadConfig();
  if (config.accounts.length === 0) {
    console.log(
      chalk.red("No accounts configured. Please setup an account first.")
    );
    return;
  }

  // Allow user to select which account context to use (for SSH host mapping)
  // Or maybe we try to match them all?
  // Strategy: We need to know which account (identity) we are syncing.
  // The user request says "Repo Pull Logic" but doesn't explicitly say if it pulls ALL accounts or one.
  // Logic 10 says "based on account".
  // Let's ask user which account to pull for.

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to pull repositories for:",
      choices: config.accounts.map((acc) => ({
        name: `${acc.username} (${acc.id})`,
        value: acc.id,
      })),
    },
  ]);

  const account = config.accounts.find((a) => a.id === accountId);
  if (!account) return; // Should not happen

  console.log(chalk.blue(`Pulling repos for ${account.username}...`));

  try {
    const token = await getGithubToken();
    const spinner = ora("Fetching repository list...").start();
    let repos = [];
    try {
      repos = await fetchRepos(token);
      spinner.succeed(`Found ${repos.length} repositories.`);
    } catch (e) {
      spinner.fail(e.message);
      return;
    }

    // Filter?
    // User request: "Collaboration Selection (Advanced but doable)"
    // Let's implement basic filtering by owner.
    const owners = [...new Set(repos.map((r) => r.owner.login))];
    const { selectedOwners } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedOwners",
        message: "Select owners/orgs to sync:",
        choices: owners,
        default: owners,
      },
    ]);

    // Default base dir?
    // Config has baseDir, let's fallback to current dir or prompt?
    // Plan: config check.
    let baseDir = account.baseDir;
    if (!baseDir) {
      const answer = await inquirer.prompt([
        {
          name: "baseDir",
          message: "Where to clone repositories?",
          default: process.cwd(),
        },
      ]);
      baseDir = answer.baseDir;
    }

    // Expansion of ~ if needed
    if (baseDir.startsWith("~")) {
      baseDir = path.join(require("os").homedir(), baseDir.slice(1));
    }

    await fs.ensureDir(baseDir);

    for (const repo of repos) {
      if (!selectedOwners.includes(repo.owner.login)) continue;

      let folderName = repo.name;
      const potentialPath = path.join(baseDir, folderName);

      // Conflict handling: if folder exists and not this repo?
      // Simple check: if folder exists, is it this repo?
      // If conflict -> folderName = repo.name + "_" + repo.owner.login

      // This logic is simplified. Real logic checks git remote.
      if (await fs.pathExists(potentialPath)) {
        // Check remote?
        // For now, if exists, we assume it's the right one or user handles it.
        // But requirement said: if folder exists -> folderName = repo.name + "_" + repo.owner
        // We should check if it's the SAME repo.
        // If it is same repo, we pull.
        // If it is different repo (or empty dir?), we rename target.

        // Let's implement the specific rule: "if folder exists: folderName = repo.name + "_" + repo.owner"
        // Wait, rule: "Repo conflicts: repo -> repo_owner" works if there IS a conflict.
        // Just renaming blindly if it exists might duplicate if we just pulled it yesterday.
        // I should check if it needs pulling.

        // Re-reading rule: "if folder exists: folderName = repo.name + "_" + repo.owner"
        // This implies we don't want to collide with existing folders that might be from other owners.

        // Intelligent check:
        const isGit = await fs.pathExists(path.join(potentialPath, ".git"));
        if (isGit) {
          const git = simpleGit(potentialPath);
          const remotes = await git.getRemotes(true);
          const origin = remotes.find((r) => r.name === "origin");
          // Check if origin matches.
          // If matches, pull.
          // If not matches, change folderName.
          if (origin && origin.refs.fetch.includes(repo.full_name)) {
            // It is the same repo, so pull.
          } else {
            folderName = `${repo.name}_${repo.owner.login}`;
          }
        } else {
          // Folder exists but not git? Or maybe just name collision.
          folderName = `${repo.name}_${repo.owner.login}`;
        }
      }

      const targetPath = path.join(baseDir, folderName);

      // Rewrite SSH URL
      // git@github.com:owner/repo.git -> git@github.com-suffix:owner/repo.git
      let cloneUrl = repo.ssh_url;
      if (account.sshHost !== "github.com") {
        cloneUrl = cloneUrl.replace("github.com", account.sshHost);
      }

      const repoSpinner = ora(
        `Syncing ${repo.full_name} into ${folderName}...`
      ).start();

      try {
        if (await fs.pathExists(targetPath)) {
          const git = simpleGit(targetPath);
          await git.pull();
          repoSpinner.succeed(`Pulled ${folderName}`);
        } else {
          await simpleGit().clone(cloneUrl, targetPath);
          repoSpinner.succeed(`Cloned ${folderName}`);
        }
      } catch (err) {
        repoSpinner.fail(`Failed to sync ${folderName}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error(chalk.red(error.message));
  }
}

module.exports = { pullRepos };
