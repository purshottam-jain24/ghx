const { execFile } = require("child_process");
const util = require("util");
const chalk = require("chalk");
const inquirer = require("inquirer");

const execFilePromise = util.promisify(execFile);

// GitHub always exits non-zero for `ssh -T`, so success is read from the output
// `batch` stops ssh from prompting, for callers without a terminal (the GUI)
async function checkConnection(host, { batch = false } = {}) {
  const args = ["-T", "-o", "StrictHostKeyChecking=accept-new"];
  if (batch) args.push("-o", "BatchMode=yes");
  args.push(`git@${host}`);

  let output = "";
  try {
    const res = await execFilePromise("ssh", args, {
      timeout: batch ? 20000 : 0,
    });
    output = res.stderr || res.stdout || "";
  } catch (error) {
    output = error.stderr || error.stdout || error.message || "";
  }

  const ok = output.includes("successfully authenticated");
  return { ok, message: output.trim() };
}

async function testConnection(host) {
  console.log(chalk.yellow(`\nTesting connection to ${host}...`));

  const { ok, message } = await checkConnection(host);
  if (ok) {
    console.log(chalk.green.bold(`✅ Connection to ${host} successful!`));
  } else {
    console.log(chalk.red(`❌ Connection failed: ${message}`));
  }
  return ok;
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

module.exports = { checkConnection, testConnection, promptAndTestConnection };
