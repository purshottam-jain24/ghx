/* global icon */
"use strict";

const api = window.ghx;

// ---------- DOM helpers ----------

// h("div", { class: "x", onclick }, ...children). Text children are escaped;
// only `html` (used for static icon markup) is injected raw.
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key in el && typeof value !== "string") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return el;
}

const ic = (name, size, cls) =>
  h("span", { html: icon(name, size, cls) }).firstChild;

function button(
  label,
  { variant = "", size = "", iconName, onclick, disabled, busy, title } = {}
) {
  return h(
    "button",
    {
      class: `btn ${variant ? "btn-" + variant : ""} ${size ? "btn-" + size : ""}`,
      onclick,
      disabled: disabled || busy,
      title,
    },
    busy ? h("span", { class: "spinner" }) : iconName ? ic(iconName, 15) : null,
    label
  );
}

function iconButton(name, title, onclick, cls = "") {
  return h(
    "button",
    { class: `icon-btn ${cls}`, title, "aria-label": title, onclick },
    ic(name, 16)
  );
}

const $ = (sel) => document.querySelector(sel);

// ---------- State ----------

const state = {
  info: null,
  view: "accounts",
  accounts: [],
  status: {}, // accountId -> { state: "busy" | "ok" | "fail", message }
  wizard: null,
  detected: null, // GitHub SSH setups found on this machine, not yet in GHX
  detecting: false,
  repos: {
    accountId: null,
    token: "",
    showToken: false,
    loading: false,
    error: null,
    list: null,
    owners: new Set(),
    search: "",
    selected: new Set(),
    baseDir: "",
    sync: null, // { items: Map(name -> {status, error, folderName}), done }
  },
};

const sep = () => (state.info && state.info.platform === "win32" ? "\\" : "/");
const tildify = (p) =>
  state.info && p && p.startsWith(state.info.homeDir)
    ? "~" + p.slice(state.info.homeDir.length)
    : p;

// ---------- Toasts & modals ----------

function toast(type, title, sub) {
  const iconName = { success: "check", error: "alert", info: "info" }[type];
  const el = h(
    "div",
    { class: `toast ${type}` },
    ic(iconName, 17),
    h("div", null, h("div", null, title), sub ? h("small", null, sub) : null)
  );
  $("#toasts").append(el);
  setTimeout(
    () => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 220);
    },
    type === "error" ? 6000 : 3200
  );
}

function closeModal() {
  $("#modal-root").replaceChildren();
}

function openModal(content) {
  const backdrop = h(
    "div",
    {
      class: "modal-backdrop",
      onmousedown: (e) => e.target === backdrop && closeModal(),
    },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, content)
  );
  $("#modal-root").replaceChildren(backdrop);
  const focusable = backdrop.querySelector(
    "button.btn-danger, button.btn-primary"
  );
  if (focusable) focusable.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

async function copy(text, what = "Copied to clipboard") {
  try {
    await api.copy(text);
    toast("success", what);
  } catch (e) {
    toast("error", "Could not copy", e.message);
  }
}

const openGithub = (url) =>
  api
    .openExternal(url)
    .catch((e) => toast("error", "Could not open browser", e.message));

// ---------- Avatar ----------

const PALETTE = [
  "#6d5dfc",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#a855f7",
];

function avatar(username, size = 48) {
  const name = username || "?";
  const color =
    PALETTE[
      [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length
    ];
  const el = h(
    "div",
    {
      class: "avatar",
      style: `background:${color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px`,
    },
    name.slice(0, 1).toUpperCase()
  );
  const img = h("img", {
    alt: "",
    src: `https://github.com/${encodeURIComponent(name)}.png?size=${size * 2}`,
    draggable: "false",
  });
  img.addEventListener("error", () => img.remove());
  el.append(img);
  return el;
}

// ---------- Navigation ----------

const NAV = [
  { id: "accounts", label: "Accounts", icon: "users" },
  { id: "repos", label: "Repositories", icon: "repo" },
  { id: "settings", label: "Settings", icon: "settings" },
];

function go(view) {
  closeModal();
  state.view = view;
  if (view !== "wizard") state.wizard = null;
  render();
}

function renderNav() {
  const active = state.view === "wizard" ? "accounts" : state.view;
  $("#nav").replaceChildren(
    ...NAV.map((item) =>
      h(
        "button",
        {
          class: `nav-item ${active === item.id ? "active" : ""}`,
          title: item.label,
          onclick: () => go(item.id),
        },
        ic(item.icon, 17),
        h("span", { class: "nav-label" }, item.label),
        item.id === "accounts" && state.accounts.length
          ? h("span", { class: "nav-count" }, String(state.accounts.length))
          : null
      )
    )
  );
}

function render() {
  renderNav();
  const views = {
    accounts: renderAccounts,
    wizard: renderWizard,
    repos: renderRepos,
    settings: renderSettings,
  };
  const view = $("#view");
  view.replaceChildren(h("div", { class: "view-inner" }, views[state.view]()));
  view.scrollTop = 0;
  // The sync panel is filled in place so progress events can update it cheaply
  if (state.view === "repos" && state.repos.sync) updateSyncPanel();
  if (state.view === "accounts") fillDetected();
}

async function refreshAccounts() {
  try {
    state.accounts = await api.accounts.list();
  } catch (e) {
    toast("error", "Could not load accounts", e.message);
  }
}

// ---------- Accounts ----------

function startWizard() {
  const isFirst = state.accounts.length === 0;
  state.wizard = {
    isFirst,
    step: 1,
    form: {
      username: "",
      email: "",
      name: "",
      suffix: "",
      passphrase: "",
      overwriteKey: false,
    },
    existingKey: null,
    showPass: false,
    busy: false,
    error: null,
    result: null,
    verify: null,
  };
  go("wizard");
}

function renderAccounts() {
  if (!state.accounts.length) {
    return h("div", null, h("div", { id: "detected-slot" }), renderWelcome());
  }

  return h(
    "div",
    null,
    h(
      "div",
      { class: "page-head" },
      h(
        "div",
        null,
        h("h1", { class: "page-title" }, "Accounts"),
        h(
          "p",
          { class: "page-sub" },
          `${state.accounts.length} GitHub ${state.accounts.length === 1 ? "account" : "accounts"} on this device, each with its own SSH key.`
        )
      ),
      h(
        "div",
        { class: "row wrap" },
        button("Scan this computer", {
          iconName: "search",
          busy: state.detecting,
          onclick: scanDetected,
        }),
        button("Add account", {
          variant: "primary",
          iconName: "plus",
          onclick: startWizard,
        })
      )
    ),
    h("div", { id: "detected-slot" }),
    h(
      "div",
      { class: "grid-accounts" },
      state.accounts.map(accountCard),
      h(
        "button",
        { class: "add-card", onclick: startWizard },
        h("div", { class: "plus" }, ic("plus", 20)),
        "Add another account"
      )
    )
  );
}

function renderWelcome() {
  const feature = (name, title, text) =>
    h(
      "div",
      { class: "feature" },
      ic(name, 20),
      h("b", null, title),
      h("span", null, text)
    );
  return h(
    "div",
    { class: "card hero" },
    h("div", { class: "hero-mark", html: icon("logo", 34) }),
    h("h2", null, "Welcome to GHX"),
    h(
      "p",
      null,
      "Use several GitHub accounts on one machine without SSH headaches. GHX creates a key per account, wires up your SSH config and keeps your repositories in sync."
    ),
    button("Set up your first account", {
      variant: "primary",
      size: "lg",
      iconName: "arrowRight",
      onclick: startWizard,
    }),
    h(
      "div",
      { class: "feature-row" },
      feature(
        "key",
        "One key per account",
        "Ed25519 keys generated and added to ssh-agent for you."
      ),
      feature(
        "shield",
        "Clean SSH config",
        "Host aliases so each repo talks to the right account."
      ),
      feature(
        "download",
        "Bulk clone & update",
        "Pull every repository you own or collaborate on."
      )
    )
  );
}

function statusView(id) {
  const s = state.status[id];
  if (!s)
    return h(
      "span",
      { class: "status" },
      h("span", { class: "status-dot" }),
      "Not tested"
    );
  if (s.state === "busy")
    return h(
      "span",
      { class: "status busy" },
      h("span", { class: "spinner" }),
      "Testing…"
    );
  if (s.state === "ok")
    return h(
      "span",
      { class: "status ok" },
      h("span", { class: "status-dot" }),
      "Connected"
    );
  return h(
    "span",
    { class: "status fail", title: s.message },
    h("span", { class: "status-dot" }),
    "Connection failed"
  );
}

function accountCard(acc) {
  const isDefault = acc.sshHost === "github.com";
  const statusSlot = h("div", { class: "grow" }, statusView(acc.id));

  const test = async () => {
    state.status[acc.id] = { state: "busy" };
    statusSlot.replaceChildren(statusView(acc.id));
    try {
      const res = await api.accounts.verify(acc.id);
      state.status[acc.id] = {
        state: res.ok ? "ok" : "fail",
        message: res.message,
      };
      if (res.ok)
        toast(
          "success",
          `@${acc.username} is connected`,
          "GitHub accepted the SSH key."
        );
      else
        toast(
          "error",
          `@${acc.username} could not connect`,
          res.message || "Make sure the key is added to GitHub."
        );
    } catch (e) {
      state.status[acc.id] = { state: "fail", message: e.message };
      toast("error", "Connection test failed", e.message);
    }
    statusSlot.replaceChildren(statusView(acc.id));
  };

  const copyKey = async () => {
    try {
      await copy(await api.accounts.publicKey(acc.id), "Public key copied");
    } catch (e) {
      toast("error", "Could not read public key", e.message);
    }
  };

  return h(
    "div",
    { class: "card account-card" },
    h(
      "div",
      { class: "account-top" },
      avatar(acc.username),
      h(
        "div",
        { style: "min-width:0;flex:1" },
        h("div", { class: "account-name" }, acc.name || acc.username),
        h("div", { class: "account-handle" }, `@${acc.username}`)
      ),
      h(
        "span",
        { class: `badge ${isDefault ? "badge-accent" : ""}` },
        isDefault ? "Default" : acc.id
      )
    ),
    h(
      "div",
      { class: "account-meta" },
      h(
        "div",
        { class: "meta-row" },
        ic("mail", 15),
        h("span", { class: "selectable" }, acc.email)
      ),
      h(
        "div",
        { class: "meta-row" },
        ic("globe", 15),
        h("span", { class: "mono selectable" }, `git@${acc.sshHost}`)
      ),
      h(
        "div",
        { class: "meta-row" },
        ic("key", 15),
        h("span", { class: "mono selectable" }, tildify(acc.sshKey))
      )
    ),
    h(
      "div",
      { class: "account-foot" },
      statusSlot,
      button("Test", { size: "sm", iconName: "pulse", onclick: test }),
      iconButton("copy", "Copy public key", copyKey),
      iconButton("external", "Open GitHub SSH settings", () =>
        openGithub("https://github.com/settings/keys")
      ),
      iconButton("trash", "Remove account", () => confirmRemove(acc), "danger")
    )
  );
}

function confirmRemove(acc) {
  let deleteKey = false;
  let busy = false;
  const removeBtn = button("Remove account", {
    variant: "danger",
    onclick: async () => {
      if (busy) return;
      busy = true;
      removeBtn.disabled = true;
      try {
        await api.accounts.remove(acc.id, { deleteKey });
        delete state.status[acc.id];
        await refreshAccounts();
        closeModal();
        render();
        scanDetected();
        toast(
          "success",
          `Removed ${acc.username}`,
          deleteKey ? "SSH key files were deleted." : "SSH key files were kept."
        );
      } catch (e) {
        busy = false;
        removeBtn.disabled = false;
        toast("error", "Could not remove account", e.message);
      }
    },
  });

  openModal([
    h(
      "div",
      { class: "modal-body" },
      h("div", { class: "modal-icon" }, ic("trash", 19)),
      h(
        "div",
        null,
        h("h3", null, `Remove @${acc.username}?`),
        h(
          "p",
          null,
          `GHX will forget this account and remove the `,
          h("span", { class: "inline-code" }, acc.sshHost),
          ` entry from your SSH config.`
        ),
        h(
          "label",
          { class: "checkbox" },
          h("input", {
            type: "checkbox",
            onchange: (e) => (deleteKey = e.target.checked),
          }),
          h(
            "span",
            null,
            "Also delete the SSH key files ",
            h("span", { class: "hint" }, `(${tildify(acc.sshKey)})`)
          ),
          h(
            "div",
            { class: "hint", style: "margin-top:10px" },
            "The key stays on GitHub until you remove it there. ",
            h(
              "a",
              {
                href: "#",
                onclick: (e) => {
                  e.preventDefault();
                  openGithub("https://github.com/settings/keys");
                },
              },
              "Open GitHub SSH keys"
            )
          )
        )
      )
    ),
    h(
      "div",
      { class: "modal-foot" },
      button("Cancel", { onclick: closeModal }),
      removeBtn
    ),
  ]);
}

// ---------- Existing setups on this computer ----------

async function scanDetected() {
  if (state.detecting) return;
  state.detecting = true;
  if (state.view === "accounts") render();
  try {
    state.detected = await api.accounts.detect();
  } catch (e) {
    state.detected = [];
    toast("error", "Could not scan this computer", e.message);
  }
  state.detecting = false;
  if (state.view === "accounts") render();
}

// Filled in place (like the sync panel) so a rescan doesn't reset the page
function fillDetected() {
  const slot = document.getElementById("detected-slot");
  if (!slot) return;
  const list = state.detected || [];

  if (state.detecting && !list.length) {
    slot.replaceChildren(
      h(
        "div",
        { class: "card detect-card scanning" },
        h("span", { class: "spinner" }),
        h(
          "div",
          null,
          h("b", null, "Looking for GitHub accounts on this computer…"),
          h(
            "div",
            { class: "hint" },
            "Checking ~/.ssh and asking GitHub which account each key belongs to."
          )
        )
      )
    );
    return;
  }
  if (!list.length) return slot.replaceChildren();

  slot.replaceChildren(
    h(
      "div",
      { class: "card detect-card" },
      h(
        "div",
        { class: "detect-head" },
        h("div", { class: "detect-badge" }, ic("sparkles", 18)),
        h(
          "div",
          { class: "grow" },
          h(
            "h3",
            { class: "card-title" },
            `Found ${list.length} GitHub ${list.length === 1 ? "setup" : "setups"} on this computer`
          ),
          h(
            "p",
            { class: "card-sub" },
            "Import them to manage them here. Your keys and SSH config stay exactly as they are."
          )
        ),
        iconButton("refresh", "Scan again", scanDetected)
      ),
      list.map(detectedRow)
    )
  );
}

function detectedRow(c) {
  const verified = c.authenticated && c.username;
  return h(
    "div",
    { class: "detect-row" },
    c.username
      ? avatar(c.username, 38)
      : h("div", { class: "detect-key" }, ic("key", 17)),
    h(
      "div",
      { class: "detect-main" },
      h(
        "div",
        { class: "detect-title" },
        c.username ? `@${c.username}` : "Unknown GitHub account",
        verified
          ? h(
              "span",
              { class: "badge badge-success" },
              ic("check", 11),
              "Verified"
            )
          : h(
              "span",
              { class: "badge badge-outline", title: c.message || "" },
              c.keyExists ? "Key not on GitHub" : "Key file missing"
            )
      ),
      h(
        "div",
        { class: "detect-meta mono" },
        `git@${c.sshHost}`,
        c.keyPath ? h("span", { class: "dot-sep" }, tildify(c.keyPath)) : null
      )
    ),
    h(
      "div",
      { class: "row" },
      button("Import", {
        size: "sm",
        variant: verified ? "primary" : "",
        iconName: "download",
        onclick: () => openImport(c),
      }),
      iconButton(
        "trash",
        "Delete this setup",
        () => confirmRemoveDetected(c),
        "danger"
      )
    )
  );
}

function confirmRemoveDetected(c) {
  const keyOnly = !c.aliases.length;
  let deleteKey = keyOnly;
  const removeBtn = button("Delete", {
    variant: "danger",
    onclick: async () => {
      removeBtn.disabled = true;
      try {
        await api.accounts.removeDetected({
          aliases: c.aliases,
          keyPath: c.keyPath,
          deleteKey,
        });
        state.detected = (state.detected || []).filter((d) => d !== c);
        closeModal();
        render();
        toast(
          "success",
          "GitHub setup deleted",
          deleteKey ? "Key files were deleted." : "Key files were kept."
        );
      } catch (e) {
        removeBtn.disabled = false;
        toast("error", "Could not delete", e.message);
      }
    },
  });

  const who = c.username ? `@${c.username}` : "this GitHub setup";
  openModal([
    h(
      "div",
      { class: "modal-body" },
      h("div", { class: "modal-icon" }, ic("trash", 19)),
      h(
        "div",
        { class: "stack grow", style: "gap:12px" },
        h(
          "div",
          null,
          h("h3", null, `Delete ${who}?`),
          keyOnly
            ? h(
                "p",
                { style: "margin:0" },
                "This setup is only a key file, so deleting it removes the key."
              )
            : h(
                "p",
                { style: "margin:0" },
                "Removes ",
                c.aliases.map((a, i) => [
                  i ? ", " : "",
                  h("span", { class: "inline-code" }, a),
                ]),
                " from your SSH config."
              )
        ),
        c.keyPath && c.keyExists
          ? h(
              "label",
              { class: "checkbox" },
              h("input", {
                type: "checkbox",
                checked: deleteKey,
                disabled: keyOnly,
                onchange: (e) => (deleteKey = e.target.checked),
              }),
              h(
                "span",
                null,
                "Also delete the key files ",
                h("span", { class: "hint" }, `(${tildify(c.keyPath)})`)
              )
            )
          : null,
        c.source === "default-key" ||
          /id_(ed25519|rsa|ecdsa)$/.test(c.keyPath || "")
          ? h(
              "div",
              { class: "callout warn" },
              ic("alert", 16),
              h(
                "div",
                null,
                "This looks like a default SSH key. It may also be used to log in to servers or other Git hosts."
              )
            )
          : null,
        c.authenticated
          ? h(
              "div",
              { class: "hint" },
              "The key stays listed on GitHub until you remove it there too. ",
              h(
                "a",
                {
                  href: "#",
                  onclick: (e) => {
                    e.preventDefault();
                    openGithub("https://github.com/settings/keys");
                  },
                },
                "Open GitHub SSH keys"
              )
            )
          : null
      )
    ),
    h(
      "div",
      { class: "modal-foot" },
      button("Cancel", { onclick: closeModal }),
      removeBtn
    ),
  ]);
}

function openImport(c) {
  const form = {
    username: c.username || "",
    email: c.email || "",
    label: c.label,
  };
  const field = (key, label, attrs = {}) =>
    h(
      "div",
      { class: "field" },
      h("label", { class: "label" }, label),
      h("input", {
        class: "input",
        value: form[key],
        spellcheck: "false",
        autocomplete: "off",
        oninput: (e) => (form[key] = e.target.value),
        ...attrs,
      })
    );

  const importBtn = button("Import account", {
    variant: "primary",
    onclick: async () => {
      importBtn.disabled = true;
      try {
        const account = await api.accounts.import({
          sshHost: c.sshHost,
          keyPath: c.keyPath,
          name: c.name,
          ...form,
        });
        state.detected = (state.detected || []).filter(
          (d) => d.sshHost !== c.sshHost
        );
        if (c.authenticated) state.status[account.id] = { state: "ok" };
        await refreshAccounts();
        closeModal();
        render();
        toast("success", `Imported @${account.username}`);
      } catch (e) {
        importBtn.disabled = false;
        toast("error", "Could not import", e.message);
      }
    },
  });

  openModal([
    h(
      "div",
      { class: "modal-body" },
      h("div", { class: "modal-icon accent" }, ic("download", 19)),
      h(
        "div",
        { class: "stack grow", style: "gap:14px" },
        h(
          "div",
          null,
          h("h3", null, "Import existing account"),
          h(
            "p",
            { style: "margin:0" },
            "GHX will use ",
            h("span", { class: "inline-code" }, `git@${c.sshHost}`),
            " as is."
          )
        ),
        field("username", "GitHub username", { placeholder: "octocat" }),
        field("email", "Commit email", {
          type: "email",
          placeholder: "you@example.com",
        }),
        field("label", "Account label", { placeholder: "work" })
      )
    ),
    h(
      "div",
      { class: "modal-foot" },
      button("Cancel", { onclick: closeModal }),
      importBtn
    ),
  ]);
}

// ---------- Add-account wizard ----------

function stepper(step) {
  const steps = ["Account details", "Add key to GitHub", "Verify"];
  const parts = [];
  steps.forEach((label, i) => {
    const n = i + 1;
    const cls = n < step ? "done" : n === step ? "active" : "";
    if (i)
      parts.push(h("div", { class: `step-line ${n <= step ? "done" : ""}` }));
    parts.push(
      h(
        "div",
        { class: `step ${cls}` },
        h("div", { class: "step-num" }, n < step ? ic("check", 14) : String(n)),
        h("span", { class: "step-label" }, label)
      )
    );
  });
  return h("div", { class: "stepper" }, parts);
}

function renderWizard() {
  const w = state.wizard;
  const body = { 1: wizardDetails, 2: wizardKey, 3: wizardVerify }[w.step]();
  return h(
    "div",
    { class: "wizard" },
    h(
      "button",
      {
        class: "back-link",
        onclick: async () => {
          await refreshAccounts();
          go("accounts");
        },
      },
      ic("arrowLeft", 15),
      w.step === 1 ? "Cancel" : "Back to accounts"
    ),
    h(
      "h1",
      { class: "page-title", style: "margin-bottom:4px" },
      w.isFirst ? "Set up GitHub" : "Add a GitHub account"
    ),
    h(
      "p",
      { class: "page-sub", style: "margin-bottom:22px" },
      w.isFirst
        ? "Your first account uses the standard github.com host, so existing clone URLs keep working."
        : "Each extra account gets its own SSH key and host alias."
    ),
    stepper(w.step),
    body
  );
}

function textField({
  key,
  label,
  placeholder,
  hint,
  optional,
  type = "text",
  iconName,
  autofocus,
  oninput,
}) {
  const w = state.wizard;
  const input = h("input", {
    class: "input",
    type,
    value: w.form[key],
    placeholder,
    autocomplete: "off",
    spellcheck: "false",
    oninput: (e) => {
      w.form[key] = e.target.value;
      e.target.classList.remove("invalid");
      if (oninput) oninput(e.target.value);
    },
  });
  input.dataset.key = key;
  if (autofocus) setTimeout(() => input.focus(), 30);
  return h(
    "div",
    { class: "field" },
    h(
      "label",
      { class: "label" },
      label,
      optional ? h("span", { class: "opt" }, " (optional)") : null
    ),
    iconName
      ? h("div", { class: "input-wrap" }, ic(iconName, 15), input)
      : input,
    hint
      ? hint instanceof Node
        ? hint
        : h("div", { class: "hint" }, hint)
      : null
  );
}

let keyCheckTimer;

function wizardDetails() {
  const w = state.wizard;
  const hostHint = h("div", { class: "hint" });
  const keyNotice = h("div");

  const updateHost = () => {
    const s = w.form.suffix.trim().toLowerCase();
    hostHint.replaceChildren(
      "SSH host ",
      h("span", { class: "inline-code" }, `github.com-${s || "label"}`)
    );
  };

  const renderKeyNotice = () => {
    if (!w.existingKey) return keyNotice.replaceChildren();
    keyNotice.replaceChildren(
      h(
        "div",
        { class: "callout warn" },
        ic("alert", 16),
        h(
          "div",
          { class: "stack", style: "gap:8px" },
          h(
            "div",
            null,
            "A key already exists at ",
            h("span", { class: "inline-code" }, tildify(w.existingKey)),
            ". GHX will reuse it unless you replace it."
          ),
          h(
            "label",
            { class: "checkbox" },
            h("input", {
              type: "checkbox",
              checked: w.form.overwriteKey,
              onchange: (e) => (w.form.overwriteKey = e.target.checked),
            }),
            "Replace it with a new key"
          )
        )
      )
    );
  };

  const checkKey = () => {
    clearTimeout(keyCheckTimer);
    keyCheckTimer = setTimeout(async () => {
      try {
        w.existingKey = await api.accounts.keyExists({ suffix: w.form.suffix });
      } catch {
        w.existingKey = null;
      }
      renderKeyNotice();
    }, 250);
  };

  updateHost();
  checkKey();

  const passInput = h("input", {
    class: "input",
    type: w.showPass ? "text" : "password",
    value: w.form.passphrase,
    placeholder: "Leave empty for no passphrase",
    autocomplete: "new-password",
    oninput: (e) => (w.form.passphrase = e.target.value),
  });
  const passToggle = iconButton(
    w.showPass ? "eyeOff" : "eye",
    "Show passphrase",
    () => {
      w.showPass = !w.showPass;
      passInput.type = w.showPass ? "text" : "password";
      passToggle.innerHTML = icon(w.showPass ? "eyeOff" : "eye", 16);
    }
  );

  const errorBox = w.error
    ? h(
        "div",
        { class: "callout danger" },
        ic("alert", 16),
        h("div", null, w.error)
      )
    : null;

  const submit = async (e) => {
    e.preventDefault();
    const required = ["username", "email"].concat(w.isFirst ? [] : ["suffix"]);
    const missing = required.filter((k) => !w.form[k].trim());
    if (
      !/^\S+@\S+\.\S+$/.test(w.form.email.trim()) &&
      !missing.includes("email")
    )
      missing.push("email");
    if (missing.length) {
      missing.forEach((k) => {
        const el = document.querySelector(`input[data-key="${k}"]`);
        if (el) el.classList.add("invalid");
      });
      const first = document.querySelector(`input[data-key="${missing[0]}"]`);
      if (first) first.focus();
      return;
    }

    w.busy = true;
    w.error = null;
    render();
    try {
      w.result = await api.accounts.create(w.form);
      w.step = 2;
      await refreshAccounts();
      try {
        await api.copy(w.result.publicKey);
        w.copied = true;
      } catch {
        w.copied = false;
      }
    } catch (err) {
      w.error = err.message;
    }
    w.busy = false;
    render();
  };

  return h(
    "form",
    { class: "card", onsubmit: submit },
    h(
      "div",
      { class: "card-pad stack" },
      h(
        "div",
        { class: "field-row" },
        textField({
          key: "username",
          label: "GitHub username",
          placeholder: "octocat",
          iconName: "users",
          autofocus: true,
        }),
        w.isFirst
          ? textField({
              key: "name",
              label: "Commit name",
              placeholder: "Mona Lisa",
              optional: true,
              hint: "Set as your global git user.name",
            })
          : textField({
              key: "suffix",
              label: "Account label",
              placeholder: "work",
              hint: hostHint,
              oninput: () => {
                updateHost();
                checkKey();
              },
            })
      ),
      textField({
        key: "email",
        label: "Email",
        placeholder: "you@example.com",
        type: "email",
        iconName: "mail",
        hint: "Used as the key comment and the commit email for this account's repos.",
      }),
      h(
        "div",
        { class: "field" },
        h(
          "label",
          { class: "label" },
          "Key passphrase",
          h("span", { class: "opt" }, " (optional)")
        ),
        h(
          "div",
          { class: "input-wrap" },
          ic("lock", 15),
          passInput,
          passToggle
        ),
        h(
          "div",
          { class: "hint" },
          "Protects the private key on disk. You may be asked for it when using git."
        )
      ),
      keyNotice,
      errorBox
    ),
    h(
      "div",
      { class: "wizard-foot" },
      h(
        "span",
        { class: "hint" },
        "Creates an Ed25519 key in ",
        h("span", { class: "inline-code" }, tildify(state.info.sshDir))
      ),
      h(
        "button",
        { class: "btn btn-primary", type: "submit", disabled: w.busy },
        w.busy ? h("span", { class: "spinner" }) : null,
        w.busy ? "Creating key…" : "Create key",
        w.busy ? null : ic("arrowRight", 15)
      )
    )
  );
}

function wizardKey() {
  const w = state.wizard;
  const { publicKey, warnings, reusedKey, account } = w.result;
  const title =
    account.id === "default"
      ? "My Device (GHX)"
      : `My Device (GHX - ${account.id})`;

  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-pad stack" },
      h(
        "div",
        { class: "callout success" },
        ic("check", 16),
        h(
          "div",
          null,
          h(
            "b",
            null,
            reusedKey
              ? "Account saved using your existing key."
              : "SSH key created and account saved."
          ),
          w.copied ? " The public key is already on your clipboard." : ""
        )
      ),
      warnings.map((msg) =>
        h(
          "div",
          { class: "callout warn" },
          ic("alert", 16),
          h("div", null, msg)
        )
      ),
      h(
        "div",
        null,
        h(
          "div",
          { class: "row between", style: "margin-bottom:8px" },
          h("span", { class: "label" }, "Your public key"),
          button("Copy", {
            size: "sm",
            iconName: "copy",
            onclick: () => copy(publicKey, "Public key copied"),
          })
        ),
        h("div", { class: "key-box" }, publicKey)
      ),
      h(
        "ol",
        { class: "instructions" },
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Open ",
            h("b", null, "GitHub → Settings → SSH and GPG keys"),
            " while signed in as ",
            h("b", null, `@${account.username}`),
            "."
          )
        ),
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Click ",
            h("b", null, "New SSH key"),
            " and use the title ",
            h("code", null, title),
            "."
          )
        ),
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Keep ",
            h("b", null, "Authentication Key"),
            ", paste the key, and click ",
            h("b", null, "Add SSH key"),
            "."
          )
        )
      ),
      h(
        "div",
        null,
        button("Open GitHub SSH settings", {
          iconName: "external",
          onclick: () => openGithub("https://github.com/settings/ssh/new"),
        })
      )
    ),
    h(
      "div",
      { class: "wizard-foot" },
      h(
        "span",
        { class: "hint" },
        "Signed in as someone else? Sign out on GitHub first."
      ),
      button("I've added the key", {
        variant: "primary",
        iconName: "arrowRight",
        onclick: () => {
          w.step = 3;
          render();
          runVerify();
        },
      })
    )
  );
}

async function runVerify() {
  const w = state.wizard;
  w.verify = { state: "busy" };
  render();
  try {
    const res = await api.accounts.verify(w.result.account.id);
    w.verify = { state: res.ok ? "ok" : "fail", message: res.message };
    state.status[w.result.account.id] = w.verify;
  } catch (e) {
    w.verify = { state: "fail", message: e.message };
  }
  if (state.view === "wizard" && state.wizard === w) render();
}

function wizardVerify() {
  const w = state.wizard;
  const v = w.verify || { state: "busy" };
  const host = w.result.account.sshHost;

  if (v.state === "busy") {
    return h(
      "div",
      { class: "card verify-panel" },
      h("div", { class: "verify-icon busy" }, h("span", { class: "spinner" })),
      h("h3", null, "Testing connection…"),
      h("p", null, `Connecting to GitHub as git@${host}`)
    );
  }

  if (v.state === "ok") {
    return h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "verify-panel" },
        h("div", { class: "verify-icon ok" }, ic("check", 30)),
        h("h3", null, "You're all set!"),
        h(
          "p",
          null,
          `GitHub recognises the key for @${w.result.account.username}. Clone repositories for this account with:`
        ),
        h(
          "div",
          { class: "code-line", style: "max-width:460px;margin:16px auto 0" },
          h(
            "code",
            { class: "selectable" },
            `git clone git@${host}:owner/repo.git`
          ),
          iconButton("copy", "Copy", () =>
            copy(`git clone git@${host}:owner/repo.git`)
          )
        )
      ),
      h(
        "div",
        { class: "wizard-foot" },
        button("Done", { onclick: () => go("accounts") }),
        button("Pull repositories", {
          variant: "primary",
          iconName: "download",
          onclick: () => {
            selectRepoAccount(w.result.account.id);
            go("repos");
          },
        })
      )
    );
  }

  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "verify-panel" },
      h("div", { class: "verify-icon fail" }, ic("x", 30)),
      h("h3", null, "GitHub didn't accept the key yet"),
      h(
        "p",
        null,
        "Make sure you added the key to the right GitHub account. It can take a few seconds to become active."
      ),
      v.message
        ? h(
            "div",
            { class: "output", style: "max-width:520px;margin:16px auto 0" },
            v.message
          )
        : null,
      state.info.agentHint
        ? h(
            "div",
            {
              class: "callout",
              style: "max-width:520px;margin:14px auto 0;text-align:left",
            },
            ic("info", 16),
            h("div", { class: "selectable" }, state.info.agentHint)
          )
        : null
    ),
    h(
      "div",
      { class: "wizard-foot" },
      button("Back to key", {
        iconName: "arrowLeft",
        onclick: () => {
          w.step = 2;
          render();
        },
      }),
      button("Try again", {
        variant: "primary",
        iconName: "refresh",
        onclick: runVerify,
      })
    )
  );
}

// ---------- Repositories ----------

const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  "C#": "#178600",
  "C++": "#f34b7d",
  C: "#555555",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Vue: "#41b883",
};

function relTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return `${n} ${unit}${n > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

function selectRepoAccount(id) {
  const r = state.repos;
  const acc = state.accounts.find((a) => a.id === id) || state.accounts[0];
  if (!acc) return;
  r.accountId = acc.id;
  r.baseDir = acc.baseDir || `${state.info.homeDir}${sep()}GitHub`;
  r.sync = null;
}

function renderRepos() {
  const r = state.repos;

  const head = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      null,
      h("h1", { class: "page-title" }, "Repositories"),
      h(
        "p",
        { class: "page-sub" },
        "Clone or update every repository you can access, using the right SSH identity."
      )
    )
  );

  if (!state.accounts.length) {
    return h(
      "div",
      null,
      head,
      h(
        "div",
        { class: "card empty" },
        h("div", { class: "icon-wrap" }, ic("users", 24)),
        h("b", null, "Add an account first"),
        h(
          "p",
          { style: "margin:0 0 16px" },
          "Repositories are cloned through an account's SSH key."
        ),
        button("Set up an account", {
          variant: "primary",
          iconName: "plus",
          onclick: startWizard,
        })
      )
    );
  }

  if (!r.accountId || !state.accounts.some((a) => a.id === r.accountId))
    selectRepoAccount(state.accounts[0].id);
  if (r.sync) return h("div", null, head, renderSyncPanel());

  return h(
    "div",
    null,
    head,
    renderConnectCard(),
    r.list ? renderRepoBrowser() : null
  );
}

function renderConnectCard() {
  const r = state.repos;

  const tokenInput = h("input", {
    class: "input",
    type: r.showToken ? "text" : "password",
    value: r.token,
    placeholder: "ghp_…",
    autocomplete: "off",
    spellcheck: "false",
    oninput: (e) => (r.token = e.target.value.trim()),
    onkeydown: (e) => e.key === "Enter" && load(),
  });
  const toggle = iconButton(
    r.showToken ? "eyeOff" : "eye",
    "Show token",
    () => {
      r.showToken = !r.showToken;
      tokenInput.type = r.showToken ? "text" : "password";
      toggle.innerHTML = icon(r.showToken ? "eyeOff" : "eye", 16);
    }
  );

  const load = async () => {
    if (!r.token) {
      tokenInput.classList.add("invalid");
      tokenInput.focus();
      return;
    }
    r.loading = true;
    r.error = null;
    render();
    try {
      const list = await api.repos.fetch(r.token);
      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      r.list = list;
      r.owners = new Set(list.map((x) => x.owner));
      r.selected = new Set(
        list.filter((x) => !x.archived).map((x) => x.full_name)
      );
      r.search = "";
      toast("success", `Found ${list.length} repositories`);
    } catch (e) {
      r.error = /invalid token/i.test(e.message)
        ? "GitHub rejected this token. Check that it's a classic token with the repo scope."
        : e.message;
    }
    r.loading = false;
    render();
  };

  return h(
    "div",
    { class: "card card-pad" },
    h(
      "div",
      { class: "connect-card" },
      h(
        "div",
        { class: "field" },
        h("label", { class: "label" }, "Clone as"),
        h(
          "select",
          {
            class: "input",
            onchange: (e) => {
              selectRepoAccount(e.target.value);
              render();
            },
          },
          state.accounts.map((a) =>
            h(
              "option",
              { value: a.id, selected: a.id === r.accountId },
              `@${a.username}${a.sshHost === "github.com" ? "" : ` (${a.id})`}`
            )
          )
        )
      ),
      h(
        "div",
        { class: "field" },
        h("label", { class: "label" }, "Personal access token (classic)"),
        h("div", { class: "input-wrap" }, ic("key", 15), tokenInput, toggle)
      ),
      button(r.list ? "Reload" : "Load repositories", {
        variant: "primary",
        iconName: r.list ? "refresh" : "download",
        busy: r.loading,
        onclick: load,
      })
    ),
    r.error
      ? h(
          "div",
          { class: "callout danger", style: "margin-top:14px" },
          ic("alert", 16),
          h("div", null, r.error)
        )
      : null,
    h(
      "details",
      { class: "help", open: !r.list && !r.token },
      h("summary", null, ic("info", 15), "How do I create a token?"),
      h(
        "ol",
        { class: "instructions" },
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Open ",
            h("b", null, "Settings → Developer settings → Tokens (classic)"),
            " on GitHub and choose ",
            h("b", null, "Generate new token (classic)"),
            "."
          )
        ),
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Name it ",
            h("code", null, "GHX"),
            " and pick any expiration."
          )
        ),
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Tick the ",
            h("code", null, "repo"),
            " scope (or ",
            h("code", null, "public_repo"),
            " for public repositories only). No other scopes are needed."
          )
        ),
        h(
          "li",
          null,
          h(
            "span",
            null,
            "Paste the token above. GHX keeps it in memory only and never saves it."
          )
        )
      ),
      h(
        "div",
        { style: "margin-top:14px" },
        button("Create a token on GitHub", {
          size: "sm",
          iconName: "external",
          onclick: () =>
            openGithub(
              "https://github.com/settings/tokens/new?description=GHX&scopes=repo"
            ),
        })
      )
    )
  );
}

function visibleRepos() {
  const r = state.repos;
  const q = r.search.toLowerCase();
  return r.list.filter(
    (x) =>
      r.owners.has(x.owner) &&
      (!q ||
        x.full_name.toLowerCase().includes(q) ||
        (x.description || "").toLowerCase().includes(q))
  );
}

function renderRepoBrowser() {
  const r = state.repos;
  const listEl = h("div", { class: "repo-list" });
  const headEl = h("div", { class: "repo-head" });
  const chipsEl = h("div", { class: "chips" });
  const syncBtnSlot = h("div");
  const destPath = h(
    "div",
    { class: "dest-path selectable", title: r.baseDir },
    tildify(r.baseDir)
  );

  const ownerCounts = new Map();
  r.list.forEach((x) =>
    ownerCounts.set(x.owner, (ownerCounts.get(x.owner) || 0) + 1)
  );

  const refresh = () => {
    const visible = visibleRepos();
    const selectedVisible = visible.filter((x) =>
      r.selected.has(x.full_name)
    ).length;

    const all = h("input", {
      type: "checkbox",
      checked: visible.length > 0 && selectedVisible === visible.length,
      onchange: (e) => {
        visible.forEach((x) =>
          e.target.checked
            ? r.selected.add(x.full_name)
            : r.selected.delete(x.full_name)
        );
        refresh();
      },
    });
    all.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
    headEl.replaceChildren(
      h("label", { class: "checkbox" }, all, `${visible.length} shown`),
      h("span", { class: "spacer" }),
      `${r.selected.size} of ${r.list.length} selected`
    );

    chipsEl.replaceChildren(
      h("span", { class: "chips-label" }, "Owners"),
      ...[...ownerCounts.entries()].map(([owner, count]) =>
        h(
          "button",
          {
            class: `chip ${r.owners.has(owner) ? "on" : ""}`,
            onclick: () => {
              r.owners.has(owner)
                ? r.owners.delete(owner)
                : r.owners.add(owner);
              refresh();
            },
          },
          r.owners.has(owner) ? ic("check", 12) : null,
          owner,
          h("span", { class: "count" }, String(count))
        )
      )
    );

    listEl.replaceChildren(
      ...(visible.length
        ? visible.map((repo) => repoRow(repo, refresh))
        : [
            h(
              "div",
              { class: "empty" },
              h("div", { class: "icon-wrap" }, ic("search", 22)),
              h("b", null, "No repositories match"),
              "Try a different search or owner filter."
            ),
          ])
    );

    const count = r.list.filter((x) => r.selected.has(x.full_name)).length;
    syncBtnSlot.replaceChildren(
      button(
        count
          ? `Sync ${count} ${count === 1 ? "repository" : "repositories"}`
          : "Select repositories",
        {
          variant: "primary",
          size: "lg",
          iconName: "download",
          disabled: !count,
          onclick: startSync,
        }
      )
    );
  };

  const search = h("input", {
    class: "input",
    placeholder: "Filter repositories…",
    value: r.search,
    oninput: (e) => {
      r.search = e.target.value;
      refresh();
    },
  });

  refresh();

  return h(
    "div",
    null,
    h(
      "div",
      { class: "card repo-shell" },
      h(
        "div",
        { class: "repo-toolbar" },
        h("div", { class: "input-wrap" }, ic("search", 15), search),
        button("Select all", {
          size: "sm",
          variant: "ghost",
          onclick: () => {
            visibleRepos().forEach((x) => r.selected.add(x.full_name));
            refresh();
          },
        }),
        button("Clear", {
          size: "sm",
          variant: "ghost",
          onclick: () => {
            r.selected.clear();
            refresh();
          },
        })
      ),
      ownerCounts.size > 1 ? chipsEl : null,
      headEl,
      listEl
    ),
    h(
      "div",
      { class: "card sync-bar" },
      h(
        "div",
        { class: "dest" },
        h("div", { class: "dest-icon" }, ic("folder", 18)),
        h(
          "div",
          { style: "min-width:0" },
          h("div", { class: "dest-label" }, "Clone into"),
          destPath
        )
      ),
      button("Change…", {
        onclick: async () => {
          const picked = await api.pickFolder(r.baseDir);
          if (picked) {
            r.baseDir = picked;
            destPath.textContent = tildify(picked);
            destPath.title = picked;
          }
        },
      }),
      syncBtnSlot
    )
  );
}

function repoRow(repo, refresh) {
  const r = state.repos;
  const selected = r.selected.has(repo.full_name);
  const toggle = () => {
    selected
      ? r.selected.delete(repo.full_name)
      : r.selected.add(repo.full_name);
    refresh();
  };
  const cb = h("input", {
    type: "checkbox",
    checked: selected,
    onclick: (e) => e.stopPropagation(),
    onchange: toggle,
  });

  return h(
    "div",
    { class: `repo-row ${selected ? "selected" : ""}`, onclick: toggle },
    h("label", { class: "checkbox", onclick: (e) => e.stopPropagation() }, cb),
    h(
      "div",
      { class: "repo-main" },
      h(
        "div",
        { class: "repo-name" },
        h(
          "span",
          {
            style: "white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
          },
          h("span", { class: "owner" }, `${repo.owner} / `),
          repo.name
        ),
        repo.private
          ? h(
              "span",
              { class: "badge badge-outline" },
              ic("lock", 11),
              "Private"
            )
          : null,
        repo.fork
          ? h("span", { class: "badge badge-outline" }, ic("fork", 11), "Fork")
          : null,
        repo.archived
          ? h(
              "span",
              { class: "badge badge-outline" },
              ic("archive", 11),
              "Archived"
            )
          : null
      ),
      repo.description
        ? h("div", { class: "repo-desc" }, repo.description)
        : null
    ),
    h(
      "div",
      { class: "repo-side" },
      repo.language
        ? h(
            "span",
            { class: "lang" },
            h("span", {
              class: "lang-dot",
              style: `background:${LANG_COLORS[repo.language] || "#8a92a5"}`,
            }),
            repo.language
          )
        : null,
      h("span", { class: "ago" }, relTime(repo.updated_at))
    )
  );
}

async function startSync() {
  const r = state.repos;
  const names = r.list
    .filter((x) => r.selected.has(x.full_name))
    .map((x) => x.full_name);
  r.sync = {
    items: new Map(names.map((n) => [n, { status: "wait" }])),
    done: false,
    baseDir: r.baseDir,
  };
  render();

  const off = api.repos.onProgress((ev) => {
    if (!r.sync) return;
    r.sync.items.set(ev.repo, ev);
    updateSyncPanel();
  });
  try {
    await api.repos.sync({
      accountId: r.accountId,
      repoNames: names,
      baseDir: r.baseDir,
    });
    const acc = state.accounts.find((a) => a.id === r.accountId);
    if (acc) acc.baseDir = r.baseDir;
  } catch (e) {
    toast("error", "Sync failed", e.message);
  }
  off();
  if (!r.sync) return;
  r.sync.done = true;
  updateSyncPanel();
  const failed = [...r.sync.items.values()].filter(
    (x) => x.status === "failed"
  ).length;
  if (failed)
    toast(
      "error",
      `${failed} ${failed === 1 ? "repository" : "repositories"} failed to sync`
    );
  else toast("success", "All repositories are up to date");
}

function syncCounts() {
  const c = {
    cloned: 0,
    updated: 0,
    failed: 0,
    finished: 0,
    total: state.repos.sync.items.size,
  };
  for (const item of state.repos.sync.items.values()) {
    if (item.status in c) c[item.status]++;
    if (["cloned", "updated", "failed"].includes(item.status)) c.finished++;
  }
  return c;
}

function syncItemView(name, item) {
  const states = {
    wait: h("div", { class: "sync-state wait" }),
    syncing: h(
      "div",
      { class: "sync-state busy" },
      h("span", { class: "spinner" })
    ),
    cloned: h(
      "div",
      { class: "sync-state ok", title: "Cloned" },
      ic("download", 12)
    ),
    updated: h(
      "div",
      { class: "sync-state ok", title: "Updated" },
      ic("check", 12)
    ),
    failed: h(
      "div",
      { class: "sync-state fail", title: "Failed" },
      ic("x", 12)
    ),
  };
  const label = {
    wait: "Waiting",
    syncing: "Syncing…",
    cloned: "Cloned",
    updated: "Updated",
    failed: "Failed",
  }[item.status];
  return h(
    "div",
    { class: "sync-item" },
    states[item.status],
    h(
      "div",
      { class: "name" },
      name,
      item.folderName && !name.endsWith(`/${item.folderName}`)
        ? h("span", { class: "hint" }, `  →  ${item.folderName}`)
        : null,
      item.error ? h("span", { class: "err selectable" }, item.error) : null
    ),
    h("span", { class: "hint" }, label)
  );
}

function renderSyncPanel() {
  return h("div", { class: "card card-pad", id: "sync-panel" });
}

function updateSyncPanel() {
  const panel = document.getElementById("sync-panel");
  const r = state.repos;
  if (!panel || !r.sync) return;
  const c = syncCounts();
  const pct = c.total ? Math.round((c.finished / c.total) * 100) : 0;
  const acc = state.accounts.find((a) => a.id === r.accountId);

  panel.replaceChildren(
    h(
      "div",
      { class: "row between", style: "margin-bottom:14px" },
      h(
        "div",
        null,
        h(
          "h3",
          { class: "card-title" },
          r.sync.done
            ? c.failed
              ? "Sync finished with errors"
              : "Sync complete"
            : `Syncing repositories… ${c.finished}/${c.total}`
        ),
        h(
          "p",
          { class: "card-sub" },
          `As @${acc ? acc.username : r.accountId} into `,
          h("span", { class: "inline-code" }, tildify(r.sync.baseDir))
        )
      ),
      r.sync.done
        ? h(
            "div",
            { class: "row" },
            button("Open folder", {
              iconName: "folder",
              onclick: () => api.openPath(r.sync.baseDir),
            }),
            button("Done", {
              variant: "primary",
              onclick: () => {
                r.sync = null;
                render();
              },
            })
          )
        : h(
            "span",
            { class: "status busy" },
            h("span", { class: "spinner" }),
            `${pct}%`
          )
    ),
    h("div", { class: "progress" }, h("div", { style: `width:${pct}%` })),
    h(
      "div",
      { class: "stats" },
      h(
        "div",
        { class: "stat" },
        h("b", null, String(c.cloned)),
        h("span", null, "Cloned")
      ),
      h(
        "div",
        { class: "stat" },
        h("b", null, String(c.updated)),
        h("span", null, "Updated")
      ),
      h(
        "div",
        { class: "stat" },
        h(
          "b",
          { style: c.failed ? "color:var(--danger)" : "" },
          String(c.failed)
        ),
        h("span", null, "Failed")
      )
    ),
    h(
      "div",
      { class: "sync-list" },
      [...r.sync.items.entries()].map(([name, item]) =>
        syncItemView(name, item)
      )
    )
  );
}

// ---------- Settings ----------

function renderSettings() {
  const info = state.info;
  const unix =
    "curl -fsSL https://github.com/purshottam-jain24/ghx/releases/latest/download/install.sh | bash";
  const win =
    "irm https://github.com/purshottam-jain24/ghx/releases/latest/download/install.ps1 | iex";
  const dirOf = (p) => p.slice(0, p.lastIndexOf(sep()));

  const pathRow = (title, value, target) =>
    h(
      "div",
      { class: "setting-row" },
      h(
        "div",
        { class: "grow" },
        h("div", { class: "title" }, title),
        h(
          "div",
          { class: "value mono selectable", title: value },
          tildify(value)
        )
      ),
      iconButton("copy", "Copy path", () => copy(value, "Path copied")),
      button("Reveal", {
        size: "sm",
        iconName: "folder",
        onclick: () => api.openPath(target),
      })
    );

  const codeLine = (text) =>
    h(
      "div",
      { class: "code-line" },
      h("code", { class: "selectable" }, text),
      iconButton("copy", "Copy", () => copy(text))
    );

  return h(
    "div",
    null,
    h(
      "div",
      { class: "page-head" },
      h(
        "div",
        null,
        h("h1", { class: "page-title" }, "Settings"),
        h(
          "p",
          { class: "page-sub" },
          "Where GHX keeps things, and how to use it from the terminal."
        )
      )
    ),
    h(
      "div",
      { class: "settings-grid" },
      h(
        "div",
        { class: "card card-pad row", style: "gap:16px" },
        h("div", {
          class: "brand-mark",
          style: "width:48px;height:48px;border-radius:13px",
          html: icon("logo", 24),
        }),
        h(
          "div",
          { class: "grow", style: "flex:1" },
          h("div", { class: "card-title" }, "GHX Desktop"),
          h(
            "p",
            { class: "card-sub" },
            `Version ${info.version} · by Purshottam Jain`
          )
        ),
        button("View on GitHub", {
          iconName: "external",
          onclick: () => openGithub("https://github.com/purshottam-jain24/ghx"),
        })
      ),
      h(
        "div",
        { class: "card card-pad" },
        h("h3", { class: "card-title", style: "margin-bottom:4px" }, "Files"),
        pathRow("Config file", info.configPath, dirOf(info.configPath)),
        pathRow("SSH directory", info.sshDir, info.sshDir)
      ),
      h(
        "div",
        { class: "card card-pad stack", style: "gap:12px" },
        h(
          "div",
          null,
          h(
            "h3",
            { class: "card-title" },
            h(
              "span",
              { class: "row", style: "gap:8px" },
              ic("terminal", 16),
              "Command line"
            )
          ),
          h(
            "p",
            { class: "card-sub" },
            "Prefer the terminal or on a server? The ",
            h("span", { class: "inline-code" }, "ghx"),
            " CLI shares the same accounts and config."
          )
        ),
        info.platform === "win32" ? codeLine(win) : codeLine(unix),
        info.agentHint
          ? h(
              "div",
              { class: "callout" },
              ic("info", 16),
              h("div", { class: "selectable" }, info.agentHint)
            )
          : null
      )
    )
  );
}

// ---------- Boot ----------

async function boot() {
  try {
    state.info = await api.info();
  } catch (e) {
    state.info = {
      platform: "",
      homeDir: "",
      sshDir: "~/.ssh",
      configPath: "",
      version: "",
    };
  }
  document.body.classList.add(`platform-${state.info.platform}`);
  $("#brand-mark").innerHTML = icon("logo", 20);
  $("#sidebar-foot").replaceChildren(
    h("span", null, `Version ${state.info.version}`),
    h(
      "span",
      null,
      "CLI available as ",
      h("span", { class: "inline-code" }, "ghx")
    )
  );

  await refreshAccounts();
  render();
  scanDetected();
}

boot();
