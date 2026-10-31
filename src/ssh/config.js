const fs = require("fs-extra");
const path = require("path");
const { SSH_DIR } = require("../utils/paths");

const CONFIG_FILE = path.join(SSH_DIR, "config");

// Matches a "Host <host>" line, including indented ones written by older versions
function hostLine(host) {
  const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*Host\\s+${escaped}\\s*$`, "m");
}

async function addHostToConfig(host, identityFile) {
  try {
    await fs.ensureDir(SSH_DIR);
    let configContent = "";

    if (await fs.pathExists(CONFIG_FILE)) {
      configContent = await fs.readFile(CONFIG_FILE, "utf8");
    }

    if (hostLine(host).test(configContent)) {
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

// Drops the Host block for `host`. On a multi-alias line ("Host a b") only that
// alias is removed so the block keeps working for the others.
async function removeHostFromConfig(host) {
  try {
    if (!(await fs.pathExists(CONFIG_FILE))) return false;

    const configContent = await fs.readFile(CONFIG_FILE, "utf8");
    const lines = configContent.split(/\r?\n/);
    const newLines = [];
    let insideTargetBlock = false;
    let removed = false;

    for (const line of lines) {
      const header = line.match(/^(\s*)(Host|Match)\s+(.*)$/i);
      if (header) {
        insideTargetBlock = false;
        const patterns = header[3].trim().split(/\s+/);
        if (header[2].toLowerCase() === "host" && patterns.includes(host)) {
          removed = true;
          const rest = patterns.filter((p) => p !== host);
          if (!rest.length) {
            insideTargetBlock = true;
            continue;
          }
          newLines.push(`${header[1]}Host ${rest.join(" ")}`);
          continue;
        }
      }

      if (!insideTargetBlock) {
        newLines.push(line);
      }
    }

    if (!removed) return false;
    await fs.writeFile(CONFIG_FILE, newLines.join("\n").trim() + "\n");
    return true;
  } catch (error) {
    throw new Error(`Failed to remove host from SSH config: ${error.message}`);
  }
}

module.exports = { addHostToConfig, removeHostFromConfig };
