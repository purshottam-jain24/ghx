const fs = require("fs-extra");
const { CONFIG_PATH } = require("../utils/paths");

async function saveConfig(config) {
  try {
    await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

module.exports = { saveConfig };
