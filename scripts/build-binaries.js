const fs = require("fs-extra");
const { execSync } = require("child_process");
const path = require("path");

const distDir = path.join(__dirname, "../dist");

// Output names are referenced by install/install.sh and install/install.ps1
const TARGETS = [
  { target: "node18-win-x64", output: "ghx-tool-win.exe" },
  { target: "node18-linux-x64", output: "ghx-tool-linux" },
  { target: "node18-macos-x64", output: "ghx-tool-macos" },
  // macOS arm64 binaries must be code signed; pkg only ad-hoc signs when run on macOS
  { target: "node18-macos-arm64", output: "ghx-tool-macos-arm64" },
];

// Optional filters, e.g. `node scripts/build-binaries.js x64` or `... macos-arm64`
const filters = process.argv.slice(2);
const targets = filters.length
  ? TARGETS.filter(({ target }) => filters.some((f) => target.includes(f)))
  : TARGETS;

if (!targets.length) {
  console.error(`No targets match: ${filters.join(", ")}`);
  process.exit(1);
}

console.log("Cleaning dist directory...");
fs.removeSync(distDir);
fs.ensureDirSync(distDir);

console.log("Building binaries...");
try {
  for (const { target, output } of targets) {
    console.log(`→ ${target} (${output})`);
    execSync(`pkg . --targets ${target} --output dist/${output}`, {
      stdio: "inherit",
    });
  }
  console.log("Build complete!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
