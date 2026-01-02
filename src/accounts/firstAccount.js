const inquirer = require("inquirer");
const chalk = require("chalk");
const simpleGit = require("simple-git");
const path = require("path");
const { SSH_DIR } = require("../utils/paths");
const { generateKey } = require("../ssh/keygen");
const { addKeyToAgent } = require("../ssh/agent");
const { addHostToConfig } = require("../ssh/config");
const { loadConfig, saveConfig } = require("../config/loadConfig");
// Need to require saveConfig from saveConfig.js but loadConfig exports both?
// Wait, I separated them.
const { saveConfig: saveConfigFunc } = require("../config/saveConfig");

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

  // Set Global Git Config
  const git = simpleGit();
  console.log(chalk.blue("Setting global git config..."));
  await git.addConfig("user.name", answers.name, true, "global");
  await git.addConfig("user.email", answers.email, true, "global");

  // Save to config.json
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
  console.log(
    chalk.yellow(
      `\nIMPORTANT: Upload the public key to GitHub:\n${keyPath}.pub`
    )
  );
}

module.exports = { setupFirstAccount };
