const inquirer = require("inquirer");
const chalk = require("chalk");
const path = require("path");
const { SSH_DIR } = require("../utils/paths");
const { generateKey } = require("../ssh/keygen");
const { addKeyToAgent } = require("../ssh/agent");
const { addHostToConfig } = require("../ssh/config");
const { loadConfig } = require("../config/loadConfig");
const { saveConfig } = require("../config/saveConfig");

async function addAccount() {
  const config = await loadConfig();

  console.log(chalk.blue.bold("Add Another GitHub Account"));

  const answers = await inquirer.prompt([
    { name: "username", message: "GitHub Username:" },
    { name: "suffix", message: "Account Suffix (e.g. work, personal):" },
    { name: "email", message: "GitHub/Commit Email:" },
  ]);

  const suffix = answers.suffix.toLowerCase();
  const keyName = `id_ed25519_${suffix}`;
  const keyPath = path.join(SSH_DIR, keyName);
  const sshHost = `github.com-${suffix}`;

  await generateKey(keyPath, answers.email);
  await addKeyToAgent(keyPath);
  await addHostToConfig(sshHost, keyPath);

  // Save to config.json
  config.accounts.push({
    id: suffix,
    username: answers.username,
    sshHost: sshHost,
    sshKey: keyPath,
    email: answers.email,
  });

  await saveConfig(config);

  console.log(chalk.green("Account added successfully!"));
  console.log(
    chalk.yellow(
      `\nIMPORTANT: Upload the public key to GitHub:\n${keyPath}.pub`
    )
  );
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
}

module.exports = { addAccount };
