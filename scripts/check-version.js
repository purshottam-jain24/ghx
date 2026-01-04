const pkg = require("../package.json");
const { execSync } = require("child_process");

const tag = execSync("git describe --tags --abbrev=0").toString().trim();
const version = `v${pkg.version}`;

if (tag !== version) {
  console.error(`❌ Version mismatch`);
  console.error(`Git tag: ${tag}`);
  console.error(`package.json: ${version}`);
  process.exit(1);
}

console.log("✅ Version synced:", version);
