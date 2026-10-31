const inquirer = require("inquirer");
const chalk = require("chalk");
const { promptAndTestConnection } = require("../ssh/testConnection");
const { listAccounts, createAccount } = require("../core/accounts");
const { printPublicKey } = require("../cli/printPublicKey");

async function setupFirstAccount() {
  if ((await listAccounts()).length > 0) {
    console.log(
      chalk.red('Accounts already exist. Use "Add another account" instead.')
    );
    return;
  }

  console.log(chalk.blue.bold("Setup GitHub (First Account)"));

  const answers = await inquirer.prompt([
    { name: "username", message: "GitHub Username:" },
    { name: "email", message: "GitHub/Commit Email:" },
    { name: "name", message: "Commit Name (e.g. John Doe):" },
  ]);

  console.log(chalk.blue("Setting global git config..."));
  let result;
  try {
    result = await createAccount(answers);
  } catch (err) {
    console.log(chalk.red(`\n❌ Error setting up account: ${err.message}`));
    return;
  }

  result.warnings.forEach((w) => console.log(chalk.yellow(`⚠️  ${w}`)));
  console.log(chalk.green("First account setup complete!"));
  await printPublicKey(result.publicKey, "My Device (GHX)");

  await promptAndTestConnection("github.com");
}

module.exports = { setupFirstAccount };
