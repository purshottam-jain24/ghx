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

    if (configContent.includes(hostBlock)) {
      console.log(`Host block for ${host} already exists in config.`);
      return;
    }

    const newBlock = `
Host ${host}
  HostName github.com
  User git
  IdentityFile ${identityFile}
  IdentitiesOnly yes
`;

    await fs.appendFile(CONFIG_FILE, newBlock);
    console.log(`Added ${host} to SSH config.`);
  } catch (error) {
    throw new Error(`Failed to update SSH config: ${error.message}`);
  }
}

module.exports = { addHostToConfig };
