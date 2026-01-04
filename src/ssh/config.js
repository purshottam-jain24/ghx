const fs = require("fs-extra");
const path = require("path");
const { SSH_DIR } = require("../utils/paths");

const CONFIG_FILE = path.join(SSH_DIR, "config");

async function addHostToConfig(host, identityFile) {
  try {
    await fs.ensureDir(SSH_DIR);
    let configContent = "";

    if (await fs.pathExists(CONFIG_FILE)) {
      configContent = await fs.readFile(CONFIG_FILE, "utf8");
    }

    const hostBlock = `Host ${host}`;
    const regex = new RegExp(`^Host\\s+${host}\\s*$`, "m");

    if (regex.test(configContent)) {
      console.log(`Host block for ${host} already exists in config.`);
      return;
    }

    const newBlock = `
  Host ${host}
  HostName github.com
  User git
  IdentityFile ${identityFile}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
`;

    await fs.appendFile(CONFIG_FILE, newBlock);
    console.log(`Added ${host} to SSH config.`);
  } catch (error) {
    throw new Error(`Failed to update SSH config: ${error.message}`);
  }
}

async function removeHostFromConfig(host) {
  try {
    if (!(await fs.pathExists(CONFIG_FILE))) return;

    const configContent = await fs.readFile(CONFIG_FILE, "utf8");
    const regex = new RegExp(`^Host\\s+${host}\\s*$`, "m");

    if (!regex.test(configContent)) {
      return;
    }

    const lines = configContent.split(/\r?\n/);
    const newLines = [];
    let insideTargetBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("Host ")) {
        if (line.trim() === `Host ${host}`) {
          insideTargetBlock = true;
        } else {
          insideTargetBlock = false;
        }
      }

      if (!insideTargetBlock) {
        newLines.push(line);
      }
    }

    await fs.writeFile(CONFIG_FILE, newLines.join("\n").trim() + "\n");
  } catch (error) {
    throw new Error(`Failed to remove host from SSH config: ${error.message}`);
  }
}

module.exports = { addHostToConfig, removeHostFromConfig };
