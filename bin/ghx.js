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
    // console.log(chalk.blue('Welcome to GHX'));
    await showMenu();
  });

program.parse(process.argv);
