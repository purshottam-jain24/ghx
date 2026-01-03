#!/usr/bin/env node

/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 */

const { program } = require("commander");
const chalk = require("chalk");
const packageJson = require("../package.json");

const { showMenu } = require("../src/cli/menu");

program
  .version(packageJson.version)
  .description("GHX - GitHub Account Manager")
  .action(async () => {
    try {
      console.log(
        chalk.cyan.bold("\nGHX – GitHub Account Manager") +
          chalk.gray("\nby Purshottam Jain\n")
      );
      await showMenu();
    } catch (err) {
      console.error(chalk.red("❌ Unexpected error:"));
      console.error(err.message || err);
      process.exit(1);
    }
  });

program.parse(process.argv);
