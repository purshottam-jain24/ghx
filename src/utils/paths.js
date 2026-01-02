const os = require("os");
const path = require("path");

const HOME_DIR = os.homedir();
const GHX_DIR = path.join(HOME_DIR, ".ghx");
const CONFIG_PATH = path.join(GHX_DIR, "config.json");
const CREDENTIALS_PATH = path.join(GHX_DIR, "credentials.json");
const SSH_DIR = path.join(HOME_DIR, ".ssh");

module.exports = {
  HOME_DIR,
  GHX_DIR,
  CONFIG_PATH,
  CREDENTIALS_PATH,
  SSH_DIR,
};
