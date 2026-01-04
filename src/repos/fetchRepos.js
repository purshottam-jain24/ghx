const inquirer = require("inquirer");
const chalk = require("chalk");

async function getGithubToken() {
  console.log(chalk.yellow("\n📘 GitHub Token Creation Guide (Classic PAT)\n"));

  console.log(
    chalk.white(
      "1. Open the link below to create a New personal access token (classic)."
    )
  );

  console.log(chalk.white("2. Note / Name: ") + chalk.cyan("GHX CLI"));

  console.log(
    chalk.white("3. Expiration: ") +
      chalk.gray(
        "Choose any expiration (No expiration recommended for local tools)"
      )
  );

  console.log(chalk.white("4. Select scopes:\n"));

  console.log(
    chalk.gray("   ✔ ") +
      chalk.green("repo") +
      chalk.gray("  → Required to list private + public repositories")
  );

  console.log(chalk.gray("     OR"));

  console.log(
    chalk.gray("   ✔ ") +
      chalk.green("public_repo") +
      chalk.gray(" → Use this if you only need public repositories")
  );

  console.log(chalk.gray("\n   ⚠ No other scopes are required."));

  console.log(chalk.yellow("\n🔗 Create Token Here:"));
  console.log(chalk.cyan.underline("https://github.com/settings/tokens/new\n"));

  const { token } = await inquirer.prompt([
    {
      type: "password",
      name: "token",
      message: "Enter your GitHub Personal Access Token (classic):",
      mask: "*",
      validate: (value) =>
        value && value.length > 0 ? true : "Token is required",
    },
  ]);

  return token;
}

async function fetchRepos(token) {
  try {
    let page = 1;
    let allRepos = [];

    while (true) {
      const params = new URLSearchParams({
        per_page: "100",
        page: page.toString(),
        affiliation: "owner,collaborator,organization_member",
      });

      const response = await fetch(
        `https://api.github.com/user/repos?${params}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "GHX-CLI",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid token");
        }
        throw new Error(
          `Failed to fetch repos (Page ${page}): ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.length === 0) {
        break;
      }

      allRepos = allRepos.concat(data);
      page++;
    }

    return allRepos;
  } catch (error) {
    throw new Error(`Failed to fetch repos: ${error.message}`);
  }
}

module.exports = { fetchRepos, getGithubToken };
