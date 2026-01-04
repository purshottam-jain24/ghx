const { exec } = require("child_process");
const util = require("util");
const chalk = require("chalk");
const inquirer = require("inquirer");

const execPromise = util.promisify(exec);

async function testConnection(host) {
  console.log(chalk.yellow(`\nTesting connection to ${host}...`));

  try {
    await execPromise(`ssh -T -o StrictHostKeyChecking=accept-new git@${host}`);
  } catch (error) {
    const output = error.stderr || error.stdout || "";
    if (output.includes("successfully authenticated")) {
      console.log(chalk.green.bold(`✅ Connection to ${host} successful!`));
      return true;
    } else {
      console.log(chalk.red(`❌ Connection failed: ${output.trim()}`));
      return false;
    }
  }

  console.log(chalk.green.bold(`✅ Connection to ${host} successful!`));
  return true;
}

async function promptAndTestConnection(host) {
  console.log(
    chalk.cyan("\n---------------------------------------------------------")
  );
  console.log(chalk.cyan("Step: Verify Connection"));
  console.log(
    chalk.white(
      "Please ensure you have added the SSH key to your GitHub account settings."
    )
  );

  await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message:
        "Press Enter once you have added the key to GitHub to test the connection...",
    },
  ]);

  return await testConnection(host);
}

module.exports = { testConnection, promptAndTestConnection };
