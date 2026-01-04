const { exec } = require("child_process");
const util = require("util");
const fs = require("fs-extra");
const execPromise = util.promisify(exec);
const chalk = require("chalk");

async function generateKey(keyPath, email, passphrase = "") {
  try {
    if (await fs.pathExists(keyPath)) {
      console.log(
        chalk.yellow(`Key already exists at ${keyPath}, skipping generation.`)
      );
      return;
    }

    const path = require("path");
    await fs.ensureDir(path.dirname(keyPath));

    console.log(chalk.blue(`Generating SSH key: ${keyPath}`));
    await execPromise(
      `ssh-keygen -t ed25519 -f "${keyPath}" -C "${email}" -N "${passphrase}"`
    );
    console.log(chalk.green("SSH key generated successfully."));
  } catch (error) {
    throw new Error(`Failed to generate SSH key: ${error.message}`);
  }
}

module.exports = { generateKey };
