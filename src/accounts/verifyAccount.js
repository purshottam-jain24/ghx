const inquirer = require("inquirer");
const chalk = require("chalk");
const { loadConfig } = require("../config/loadConfig");
const { testConnection } = require("../ssh/testConnection");

async function verifyAccount() {
  const config = await loadConfig();

  if (config.accounts.length === 0) {
    console.log(chalk.yellow("No accounts configured to verify."));
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to verify connection:",
      choices: config.accounts.map((acc) => ({
        name: `${acc.username} (${acc.id})`,
        value: acc.id,
      })),
    },
  ]);

  const account = config.accounts.find((a) => a.id === accountId);
  if (!account) return;

  await testConnection(account.sshHost);
}

module.exports = { verifyAccount };
