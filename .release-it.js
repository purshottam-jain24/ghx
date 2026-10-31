module.exports = {
  git: {
    requireCleanWorkingDir: true,
    commitMessage: "chore(release): v${version} [skip ci]",
    tagName: "v${version}",
    push: true,
  },
  // The GitHub release (via `gh`) and npm publish happen in the release
  // workflow after the binaries and desktop apps are built for this tag
  github: {
    release: false,
  },
  npm: {
    publish: false,
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
