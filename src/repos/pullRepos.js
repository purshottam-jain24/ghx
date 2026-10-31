const chalk = require("chalk");
const inquirer = require("inquirer");
const { fetchRepos, getGithubToken } = require("./fetchRepos");
const { syncRepos } = require("../core/repos");
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

    let repoSpinner;
    await syncRepos({
      account,
      repos: repos.filter((r) => selectedOwners.includes(r.owner.login)),
      baseDir,
      onProgress: ({ repo, folderName, status, error }) => {
        if (status === "syncing") {
          repoSpinner = ora(`Syncing ${repo}...`).start();
        } else if (status === "failed") {
          repoSpinner.fail(`Failed to sync ${repo}: ${error}`);
        } else {
          const verb = status === "cloned" ? "Cloned" : "Updated";
          repoSpinner.succeed(`${verb} ${folderName}`);
        }
      },
    });
  } catch (error) {
    console.error(chalk.red(error.message));
  }
}

module.exports = { pullRepos };
