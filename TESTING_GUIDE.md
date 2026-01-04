# Testing Guide for GHX (Hyper-V)

Since `ghx` is a standalone binary, the best way to test it is on a **clean slate** environment (no Node.js, no SSH keys, no Git config). Windows Hyper-V is perfect for this.

## 1. Setup a Clean Windows VM

1.  Open **Hyper-V Manager** (or "Quick Create").
2.  Select **Windows 10 dev environment** (or use your own Windows ISO).
3.  Start the VM and complete the Windows setup.

## 2. Create a Checkpoint (Crucial!)

Before you run _anything_, create a checkpoint. This allows you to "reset" the VM to a clean state instantly.

1.  In Hyper-V Manager, right-click your VM -> **Checkpoint**.
2.  Name it "Clean State".
3.  Now you can wreck this VM, and just "Apply" this checkpoint to go back.

## 3. Test Scenarios

### Test A: The "One-Liner" (Release Mode)

_Pre-requisite: You must have released v1.0.0 on GitHub with assets._

1.  Open PowerShell in the VM.
2.  Run: `node -v` (Should fail "Command not found" - this is GOOD).
3.  Run the installer:
    ```powershell
    irm https://github.com/purshottam-jain24/ghx/releases/latest/download/install.ps1 | iex
    ```
4.  **Verify**:
    - [ ] Did it download?
    - [ ] Did it launch `ghx` automatically?
    - [ ] Run `ghx` again. Does it work?

### Test B: Manual Binary (Local Testing)

If you haven't released yet, you can copy your local `dist/ghx-win.exe` to the VM.

1.  Copy `dist/ghx-win.exe` to the VM (Drag & Drop or shared folder).
2.  Run in PowerShell:
    ```powershell
    .\ghx-win.exe
    ```
3.  **Verify**:
    - [ ] Does it start without installing Node.js?

### Test C: Functional Verification

Inside the VM, use `ghx` to:

1.  **Setup First Account**:
    - Provide a dummy email (e.g. `test@example.com`).
    - Check `~/.ssh/`. Is `id_ed25519` there?
    - Check `git config --list --global`. Is `user.email` set?
2.  **Add Second Account**:
    - Add "work" suffix.
    - Check `~/.ssh/`. Is `id_ed25519_work` there?
    - Check `~/.ssh/config`. Is `Host github.com-work` there?
    - Check `git config --list --global`. USER INFO SHOULD NOT CHANGE.

## 4. Reset

1.  Right-click VM -> **Apply** Checkpoint "Clean State".
2.  Repeat tests as needed.

## 5. Testing Without Pushing (Local Server)

If you don't want to release to GitHub yet, use a local server.

### Step 1: Host the files

In your project root (`ghx/`), run:

```bash
# Requires Python installed (or use 'npx serve')
python -m http.server 8000
```

_This allows your VM to download `dist/ghx-win.exe` directly._

### Step 2: Run in VM

1.  Find your host IP (run `ipconfig` on host).
2.  Open VM PowerShell.
3.  Run the local installer (you might need to download `install_local.ps1` manually or curl it):

```powershell
# Replace 192.168.x.x with your Host IP
$IP = "192.168.1.5"
irm http://$IP:8000/install_local.ps1 | iex
```

_Note: You may need to edit `install_local.ps1` to accept the IP argument or hardcode it._
