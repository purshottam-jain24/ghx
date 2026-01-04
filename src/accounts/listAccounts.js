const { loadConfig } = require("../config/loadConfig");
const chalk = require("chalk");
const { Table } = require("console-table-printer");

async function listAccounts() {
  const config = await loadConfig();

  if (config.accounts.length === 0) {
    console.log(chalk.yellow("\nNo accounts configured yet."));
    return;
  }

  const p = new Table({
    columns: [
      { name: "id", title: "ID/Suffix", alignment: "left", color: "cyan" },
      {
        name: "username",
        title: "Username",
        alignment: "left",
        color: "white",
      },
      { name: "email", title: "Email", alignment: "left", color: "green" },
      { name: "host", title: "SSH Host", alignment: "left", color: "gray" },
    ],
  });

  config.accounts.forEach((acc) => {
    p.addRow({
      id: acc.id,
      username: acc.username,
      email: acc.email,
      host: acc.sshHost,
    });
  });

  console.log(chalk.bold("\nConfigured GitHub Accounts:"));
  p.printTable();
  console.log("");
}

module.exports = { listAccounts };
