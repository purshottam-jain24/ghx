const inquirer = require("inquirer");
const chalk = require("chalk");
const simpleGit = require("simple-git");
const path = require("path");
const { SSH_DIR } = require("../utils/paths");
const { generateKey } = require("../ssh/keygen");
const { addKeyToAgent } = require("../ssh/agent");
const { addHostToConfig } = require("../ssh/config");
const { loadConfig, saveConfig } = require("../config/loadConfig");
const { saveConfig: saveConfigFunc } = require("../config/saveConfig");
const { promptAndTestConnection } = require("../ssh/testConnection");

async function setupFirstAccount() {
  const config = await loadConfig();

  if (config.accounts.length > 0) {
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

  const keyName = "id_ed25519";
  const keyPath = path.join(SSH_DIR, keyName);

  await generateKey(keyPath, answers.email);
  await addKeyToAgent(keyPath);
  await addHostToConfig("github.com", keyPath);

  const git = simpleGit();
  console.log(chalk.blue("Setting global git config..."));
  try {
    await git.addConfig("user.name", answers.name, true, "global");
    await git.addConfig("user.email", answers.email, true, "global");
  } catch (error) {
    if (error.message.includes("ENOENT")) {
      console.log(
        chalk.red(
          "❌ Git executable not found. Please ensure Git is installed and in your PATH."
        )
      );
    } else {
      console.log(
        chalk.yellow(`⚠️  Failed to set git config: ${error.message}`)
      );
    }
  }

  config.accounts.push({
    id: "default",
    username: answers.username,
    sshHost: "github.com",
    sshKey: keyPath,
    email: answers.email,
    name: answers.name,
  });

  await saveConfigFunc(config);

  console.log(chalk.green("First account setup complete!"));

  try {
    const pubKeyContent = await require("fs-extra").readFile(
      `${keyPath}.pub`,
      "utf8"
    );

    try {
      await require("clipboardy").write(pubKeyContent.trim());
      console.log(chalk.green.bold("\n✅ Public Key copied to clipboard!"));
    } catch (clipErr) {
      console.log(chalk.red("\nCould not auto-copy to clipboard."));
    }

    console.log(chalk.yellow("\nIMPORTANT: Paste this key into GitHub:"));
    console.log(chalk.cyan.underline("https://github.com/settings/ssh/new"));

    console.log(
      chalk.gray("\nSuggestion for 'Title': ") + chalk.white("My Device (GHX)")
    );
    console.log(
      chalk.gray("Suggestion for 'Key':   ") +
        chalk.white("(Paste the block below)")
    );

    console.log("\nIf the clipboard didn't work, here is the key:");
    console.log(
      chalk.cyan(
        "--------------------------------------------------------------------------------"
      )
    );
    console.log(pubKeyContent.trim());
    console.log(
      chalk.cyan(
        "--------------------------------------------------------------------------------"
      )
    );
  } catch (err) {
    console.log(chalk.red(`\nCould not read public key: ${err.message}`));
    console.log(
      chalk.yellow(
        `\nPlease open the following file manually and copy its content:`
      )
    );
    console.log(chalk.white(`${keyPath}.pub`));
  }

  await promptAndTestConnection("github.com");
}

module.exports = { setupFirstAccount };
