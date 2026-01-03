const inquirer = require("inquirer");
const chalk = require("chalk");

async function getGithubToken() {
  const { token } = await inquirer.prompt([
    {
      type: "password",
      name: "token",
      message:
        "Enter your GitHub Personal Access Token (repo, read:org scopes):",
      mask: "*",
      validate: (value) => (value.length > 0 ? true : "Token is required"),
    },
  ]);
  return token;
}

async function fetchRepos(token) {
  try {
    const params = new URLSearchParams({
      per_page: "100",
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
      throw new Error(`Failed to fetch repos: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch repos: ${error.message}`);
  }
}

module.exports = { fetchRepos, getGithubToken };
