const inquirer = require("inquirer");
const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const { loadConfig } = require("../config/loadConfig");
const { saveConfig } = require("../config/saveConfig");
const { SSH_DIR, GHX_DIR } = require("../utils/paths");
const { removeHostFromConfig } = require("../ssh/config");

async function removeAccount() {
  const config = await loadConfig();

  if (config.accounts.length === 0) {
    console.log(chalk.yellow("No accounts to remove."));
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to remove:",
      choices: config.accounts.map((acc) => ({
        name: `${acc.username} (${acc.id})`,
        value: acc.id,
      })),
    },
  ]);

  const account = config.accounts.find((a) => a.id === accountId);
  if (!account) return;

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to remove account '${account.id}'?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.blue("Operation cancelled."));
    return;
  }

  config.accounts = config.accounts.filter((a) => a.id !== accountId);
  await saveConfig(config);

  try {
    const { removeHostFromConfig } = require("../ssh/config");
    await removeHostFromConfig(account.sshHost);
    console.log(
      chalk.green(`Removed host ${account.sshHost} from SSH config.`)
    );
  } catch (err) {
    console.log(
      chalk.yellow(
        "Note: Could not automatically remove host from SSH config (function might be missing)."
      )
    );
  }

  if (account.sshKey && (await fs.pathExists(account.sshKey))) {
    const { deleteKey } = await inquirer.prompt([
      {
        type: "confirm",
        name: "deleteKey",
        message: `Do you want to delete the SSH key file (${account.sshKey})?`,
        default: false,
      },
    ]);

    if (deleteKey) {
      try {
        await fs.remove(account.sshKey);
        await fs.remove(`${account.sshKey}.pub`);
        console.log(chalk.green("SSH key files deleted."));
      } catch (err) {
        console.error(chalk.red(`Failed to delete key files: ${err.message}`));
      }
    }
  }

  console.log(
    chalk.green.bold(`\nAccount '${account.id}' removed successfully.`)
  );
}

module.exports = { removeAccount };
