const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const chalk = require("chalk");

async function addKeyToAgent(keyPath) {
  try {
    // Platform specific agent check could go here.
    // For windows, we assume ssh-agent service is running or user manages it.
    // We will try to add.
    console.log(chalk.blue(`Adding key to agent: ${keyPath}`));
    await execPromise(`ssh-add "${keyPath}"`);
    console.log(chalk.green("Key added to agent."));
  } catch (error) {
    console.error(
      chalk.red(`Failed to add key to agent. Ensure ssh-agent is running.`)
    );
    console.error(error.message);
  }
}

module.exports = { addKeyToAgent };
