const dns = require("dns");

async function checkInternetConnection() {
  return new Promise((resolve) => {
    dns.lookup("github.org", (err) => {
      if (err && err.code === "ENOTFOUND") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

module.exports = { checkInternetConnection };
