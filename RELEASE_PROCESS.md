# Release Process & Versioning Guide

This project uses an automated release workflow triggered by pushing code to the `main` branch.

## How to Trigger a Release

1.  Make your changes.
2.  Commit your changes using one of the **Conventions** below.
3.  Push to `main`.
    ```bash
    git push origin main
    ```
4.  The GitHub Action will automatically:
    - Build the binaries.
    - Bump the version number.
    - Generate a changelog entry.
    - Create a GitHub Release with assets.
    - Publish to npm.

## Commit Conventions

To ensure the version changes correctly, you must use specific prefixes in your commit messages.

### **1. FIXED: ...** (Patch Version)

Use this for bug fixes.

- **Increments**: `1.0.0` -> `1.0.1`
- **Commit as**: `fix: your message` (or `FIXED: ...` if configured, but `fix:` is safer)
- **Example**: `fix: login page validation error`

### **2. ADDED: ...** (Minor Version)

Use this for new features.

- **Increments**: `1.0.0` -> `1.1.0`
- **Commit as**: `feat: your message`
- **Example**: `feat: dark mode support`

### **3. UPDATED: ...** (Patch Version)

Use this for minor updates, refactors, or maintenance that doesn't add new features.

- **Increments**: `1.0.0` -> `1.0.1`
- **Commit as**: `chore: your message`
- **Example**: `chore: dependency versions`

> [!IMPORTANT]
> The automated tools are optimized for `fix:`, `feat:`, and `chore:`. While we aim to support `FIXED:`, using the standard `fix:` guarantees the version bump happens correctly.

## Manual Release (Fallback)

If automation fails, you can run:

```bash
npm run release
```

(Requires `GITHUB_TOKEN` and `NPM_TOKEN` environment variables).
