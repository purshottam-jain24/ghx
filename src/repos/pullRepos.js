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
  if (!account) return;

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

    if (baseDir.startsWith("~")) {
      baseDir = path.join(require("os").homedir(), baseDir.slice(1));
    }

    await fs.ensureDir(baseDir);

    for (const repo of repos) {
      if (!selectedOwners.includes(repo.owner.login)) continue;

      let folderName = repo.name;
      const potentialPath = path.join(baseDir, folderName);
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

      if (isConflict) {
        folderName = `${repo.name}+${repo.owner.login}`;
      }

      const targetPath = path.join(baseDir, folderName);

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

          await git.remote(["set-url", "origin", cloneUrl]);
          await git.fetch("origin", ["+refs/heads/*:refs/remotes/origin/*"]);
          await git.fetch(["--tags"]);
          await git.pull();

          repoSpinner.succeed(`Updated ${folderName}`);
        } else {
          await simpleGit().clone(cloneUrl, targetPath);
          const git = simpleGit(targetPath);
          await git.fetch(["--tags"]);
          repoSpinner.succeed(`Cloned ${folderName}`);
        }

        if (await fs.pathExists(path.join(targetPath, ".git"))) {
          const git = simpleGit(targetPath);
          await git.addConfig("user.name", account.username);
          await git.addConfig("user.email", account.email);
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
