const fs = require("fs-extra");
const { execSync } = require("child_process");
const path = require("path");

const distDir = path.join(__dirname, "../dist");

console.log("Cleaning dist directory...");
fs.removeSync(distDir);
fs.ensureDirSync(distDir);

console.log("Building binaries...");
try {
  execSync(
    "pkg . --out-path dist --targets node18-win-x64,node18-linux-x64,node18-macos-x64",
    {
      stdio: "inherit",
    }
  );
  console.log("Build complete!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
