module.exports = {
  git: {
    requireCleanWorkingDir: true,
    commitMessage: "chore(release): v${version} [skip ci]",
    tagName: "v${version}",
    push: true,
  },
  github: {
    release: true,
    releaseName: "v${version}",
    autoGenerate: false,
    assets: ["dist/*"],
  },
  npm: {
    publish: true,
  },
  plugins: {
    "@release-it/conventional-changelog": {
      preset: {
        name: "conventionalcommits",
        types: [
          { type: "feat", section: "Features" },
          { type: "fix", section: "Bug Fixes" },
          { type: "ADDED", section: "Features" },
          { type: "FIXED", section: "Bug Fixes" },
          { type: "UPDATED", section: "Updates" },
          { type: "perf", section: "Performance" },
          { type: "chore", section: "Miscellaneous" },
        ],
      },
      infile: "CHANGELOG.md",
    },
  },
};
