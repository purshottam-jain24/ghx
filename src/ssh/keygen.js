const { execFile } = require("child_process");
const util = require("util");
const fs = require("fs-extra");
const execFilePromise = util.promisify(execFile);
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
    // execFile passes args verbatim, so emails/passphrases need no shell quoting
    await execFilePromise("ssh-keygen", [
      "-t",
      "ed25519",
      "-f",
      keyPath,
      "-C",
      email,
      "-N",
      passphrase,
    ]);
    console.log(chalk.green("SSH key generated successfully."));
  } catch (error) {
    throw new Error(`Failed to generate SSH key: ${error.message}`);
  }
}

module.exports = { generateKey };
