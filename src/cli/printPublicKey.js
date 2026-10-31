const chalk = require("chalk");

async function printPublicKey(publicKey, title) {
  try {
    await require("clipboardy").write(publicKey);
    console.log(chalk.green.bold("\n✅ Public Key copied to clipboard!"));
  } catch (clipErr) {
    console.log(chalk.red("\nCould not auto-copy to clipboard."));
  }

  console.log(chalk.yellow("\nIMPORTANT: Paste this key into GitHub:"));
  console.log(chalk.cyan.underline("https://github.com/settings/ssh/new"));

  console.log(chalk.gray("\nSuggestion for 'Title': ") + chalk.white(title));
  console.log(
    chalk.gray("Suggestion for 'Key':   ") +
      chalk.white("(Paste the block below)")
  );

  const rule = chalk.cyan(
    "--------------------------------------------------------------------------------"
  );
  console.log("\nIf the clipboard didn't work, here is the key:");
  console.log(rule);
  console.log(publicKey);
  console.log(rule);
}

module.exports = { printPublicKey };
