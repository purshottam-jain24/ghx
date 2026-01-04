const inquirer = require("inquirer");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const { SSH_DIR } = require("../utils/paths");
const { generateKey } = require("../ssh/keygen");
const { addKeyToAgent } = require("../ssh/agent");
const { addHostToConfig } = require("../ssh/config");
const { loadConfig } = require("../config/loadConfig");
const { saveConfig } = require("../config/saveConfig");
const { checkInternetConnection } = require("../utils/internet");
const { promptAndTestConnection } = require("../ssh/testConnection");

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

  const config = await loadConfig();

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

  const suffix = answers.suffix.toLowerCase();
  const keyName = `id_ed25519_${suffix}`;
  const keyPath = path.join(SSH_DIR, keyName);
  const sshHost = `github.com-${suffix}`;
  let keyGenerated = false;

  try {
    if (await fs.pathExists(keyPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `Key ${keyName} already exists. Overwrite it?`,
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow("Using existing key..."));
      } else {
        await fs.remove(keyPath);
        await fs.remove(`${keyPath}.pub`);
        await generateKey(keyPath, answers.email, answers.passphrase);
        keyGenerated = true;
      }
    } else {
      await generateKey(keyPath, answers.email, answers.passphrase);
      keyGenerated = true;
    }

    await addKeyToAgent(keyPath);
    await addHostToConfig(sshHost, keyPath);

    config.accounts.push({
      id: suffix,
      username: answers.username,
      sshHost: sshHost,
      sshKey: keyPath,
      email: answers.email,
    });

    await saveConfig(config);

    console.log(chalk.green("Account added successfully!"));

    const pubKeyContent = await fs.readFile(`${keyPath}.pub`, "utf8");

    try {
      await require("clipboardy").write(pubKeyContent.trim());
      console.log(chalk.green.bold("\n✅ Public Key copied to clipboard!"));
    } catch (clipErr) {
      console.log(chalk.red("\nCould not auto-copy to clipboard."));
    }

    console.log(chalk.yellow("\nIMPORTANT: Paste this key into GitHub:"));
    console.log(chalk.cyan.underline("https://github.com/settings/ssh/new"));

    console.log(
      chalk.gray("\nSuggestion for 'Title': ") +
        chalk.white(`My Device (GHX - ${suffix})`)
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
    console.log(chalk.red(`\n❌ Error adding account: ${err.message}`));

    if (keyGenerated) {
      console.log(chalk.yellow("Cleaning up generated key..."));
      await fs.remove(keyPath).catch(() => {});
      await fs.remove(`${keyPath}.pub`).catch(() => {});
    }
  }

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
