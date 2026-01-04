const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const chalk = require("chalk");

async function addKeyToAgent(keyPath) {
  try {
    console.log(chalk.blue(`Adding key to agent: ${keyPath}`));
    await execPromise(`ssh-add "${keyPath}"`);
    console.log(chalk.green("Key added to agent."));
  } catch (error) {
    console.error(
      chalk.red(`Failed to add key to agent. Ensure ssh-agent is running.`)
    );
    if (process.platform === "win32") {
      console.error(
        chalk.yellow(
          "On Windows, run this in Administrator PowerShell to fix:\n" +
            "Get-Service ssh-agent | Set-Service -StartupType Automatic -PassThru | Start-Service"
        )
      );
    }
    console.error(chalk.gray(`Details: ${error.message}`));
  }
}

module.exports = { addKeyToAgent };
