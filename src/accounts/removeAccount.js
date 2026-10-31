const inquirer = require("inquirer");
const chalk = require("chalk");
const fs = require("fs-extra");
const {
  listAccounts,
  removeAccount: removeAccountCore,
} = require("../core/accounts");

async function removeAccount() {
  const accounts = await listAccounts();

  if (accounts.length === 0) {
    console.log(chalk.yellow("No accounts to remove."));
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to remove:",
      choices: accounts.map((acc) => ({
        name: `${acc.username} (${acc.id})`,
        value: acc.id,
      })),
    },
  ]);

  const account = accounts.find((a) => a.id === accountId);
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

  let deleteKey = false;
  if (account.sshKey && (await fs.pathExists(account.sshKey))) {
    ({ deleteKey } = await inquirer.prompt([
      {
        type: "confirm",
        name: "deleteKey",
        message: `Do you want to delete the SSH key file (${account.sshKey})?`,
        default: false,
      },
    ]));
  }

  try {
    const result = await removeAccountCore(accountId, { deleteKey });
    if (result.warnings.length) {
      console.log(
        chalk.yellow(
          "Note: Could not automatically remove host from SSH config."
        )
      );
    } else {
      console.log(
        chalk.green(`Removed host ${account.sshHost} from SSH config.`)
      );
    }
    if (result.keyDeleted) console.log(chalk.green("SSH key files deleted."));
  } catch (err) {
    console.error(chalk.red(`Failed to remove account: ${err.message}`));
    return;
  }

  console.log(
    chalk.green.bold(`\nAccount '${account.id}' removed successfully.`)
  );
}

module.exports = { removeAccount };
