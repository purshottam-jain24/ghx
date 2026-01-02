const fs = require("fs-extra");
const { CONFIG_PATH, GHX_DIR } = require("../utils/paths");

async function loadConfig() {
  try {
    await fs.ensureDir(GHX_DIR);
    if (!(await fs.pathExists(CONFIG_PATH))) {
      const defaultConfig = { accounts: [] };
      await fs.writeJson(CONFIG_PATH, defaultConfig, { spaces: 2 });
      return defaultConfig;
    }
    return await fs.readJson(CONFIG_PATH);
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

module.exports = { loadConfig };
