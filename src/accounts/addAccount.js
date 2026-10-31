const inquirer = require("inquirer");
const chalk = require("chalk");
const fs = require("fs-extra");
const { checkInternetConnection } = require("../utils/internet");
const { promptAndTestConnection } = require("../ssh/testConnection");
const { createAccount, accountPaths } = require("../core/accounts");
const { printPublicKey } = require("../cli/printPublicKey");

async function addAccount() {
  const isOnline = await checkInternetConnection();
  if (!isOnline) {
    console.log(chalk.red("\n❌ No internet connection detected."));
    console.log(
      chalk.yellow(
        "GHX requires internet to guide you through adding the key to GitHub."
      )
    );
    return;
  }

  console.log(chalk.blue.bold("Add Another GitHub Account"));

  const answers = await inquirer.prompt([
    { name: "username", message: "GitHub Username:" },
    { name: "suffix", message: "Account Suffix (e.g. work, personal):" },
    { name: "email", message: "GitHub/Commit Email:" },
    {
      name: "passphrase",
      type: "password",
      message: "Enter SSH Key Passphrase (leave empty for none):",
      mask: "*",
    },
  ]);

  const suffix = answers.suffix.trim().toLowerCase();
  const { keyPath, sshHost } = accountPaths(false, suffix);

  let overwriteKey = false;
  if (await fs.pathExists(keyPath)) {
    ({ overwriteKey } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwriteKey",
        message: `Key ${keyPath} already exists. Overwrite it?`,
        default: false,
      },
    ]));
    if (!overwriteKey) console.log(chalk.yellow("Using existing key..."));
  }

  let result;
  try {
    result = await createAccount({ ...answers, suffix, overwriteKey });
  } catch (err) {
    console.log(chalk.red(`\n❌ Error adding account: ${err.message}`));
    return;
  }

  result.warnings.forEach((w) => console.log(chalk.yellow(`⚠️  ${w}`)));
  console.log(chalk.green("Account added successfully!"));
  await printPublicKey(result.publicKey, `My Device (GHX - ${suffix})`);

  console.log(
    chalk.cyan(
      `\nTo clone repos for this account, use:\ngit clone git@${sshHost}:owner/repo.git`
    )
  );
  console.log(
    chalk.cyan(
      `\nInside the repo, don't forget to run:\ngit config user.name "Your Name"\ngit config user.email "${answers.email}"`
    )
  );

  await promptAndTestConnection(sshHost);
}

module.exports = { addAccount };
