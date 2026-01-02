/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 */

const inquirer = require("inquirer");
const chalk = require("chalk");
const { loadConfig } = require("../config/loadConfig");

async function showMenu() {
  console.clear();
  console.log(chalk.green.bold("🚀 GHX – GitHub Account Manager"));
  console.log(chalk.gray("   by Purshottam Jain\n"));

  const choices = [
    { name: "Setup GitHub (first time)", value: "setup" },
    { name: "Add another GitHub account", value: "add" },
    { name: "Pull repositories", value: "pull" },
    { name: "Update GHX", value: "update" },
    { name: "Exit", value: "exit" },
  ];

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices,
    },
  ]);

  switch (action) {
    case "setup":
      await require("../accounts/firstAccount").setupFirstAccount();
      break;
    case "add":
      await require("../accounts/addAccount").addAccount();
      break;
    case "pull":
      await require("../repos/pullRepos").pullRepos();
      break;
    case "update":
      console.log(
        chalk.blue("\nTo update GHX, simply run the installer again:\n")
      );
      if (process.platform === "win32") {
        console.log(
          chalk.cyan(
            "irm https://github.com/purshottam-jain24/ghx/releases/latest/download/install.ps1 | iex"
          )
        );
      } else {
        console.log(
          chalk.cyan(
            "curl -fsSL https://github.com/purshottam-jain24/ghx/releases/latest/download/install.sh | bash"
          )
        );
      }
      break;
    case "exit":
      console.log(chalk.blue("Goodbye!"));
      process.exit(0);
      break;
  }

  if (action !== "exit") {
    console.log("\nPress any key to return to menu...");
    await new Promise((resolve) => process.stdin.once("data", resolve));
    showMenu();
  }
}

module.exports = { showMenu };
