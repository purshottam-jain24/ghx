const { execFile } = require("child_process");
const util = require("util");
const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const execFilePromise = util.promisify(execFile);
const chalk = require("chalk");

// ssh-add reads passphrases from a TTY, which GUI apps don't have, so hand it
// over through SSH_ASKPASS instead (OpenSSH 8.4+). Not supported on Windows.
async function withAskpass(passphrase, fn) {
  if (!passphrase || process.platform === "win32") return fn({});

  const script = path.join(
    os.tmpdir(),
    `ghx-askpass-${process.pid}-${Date.now()}.sh`
  );
  await fs.writeFile(script, '#!/bin/sh\nprintf "%s\\n" "$GHX_PASSPHRASE"\n', {
    mode: 0o700,
  });
  try {
    return await fn({
      SSH_ASKPASS: script,
      SSH_ASKPASS_REQUIRE: "force",
      DISPLAY: process.env.DISPLAY || ":0",
      GHX_PASSPHRASE: passphrase,
    });
  } finally {
    await fs.remove(script).catch(() => {});
  }
}

async function addKeyToAgent(keyPath, passphrase = "") {
  try {
    console.log(chalk.blue(`Adding key to agent: ${keyPath}`));
    await withAskpass(passphrase, (env) =>
      execFilePromise("ssh-add", [keyPath], {
        env: { ...process.env, ...env },
        timeout: 15000,
      })
    );
    console.log(chalk.green("Key added to agent."));
    return true;
  } catch (error) {
    console.error(
      chalk.red(`Failed to add key to agent. Ensure ssh-agent is running.`)
    );
    if (process.platform === "win32") {
      console.error(chalk.yellow(WINDOWS_AGENT_HINT));
    }
    console.error(chalk.gray(`Details: ${error.message}`));
    return false;
  }
}

const WINDOWS_AGENT_HINT =
  "On Windows, run this in Administrator PowerShell to fix:\n" +
  "Get-Service ssh-agent | Set-Service -StartupType Automatic -PassThru | Start-Service";

module.exports = { addKeyToAgent, WINDOWS_AGENT_HINT };
