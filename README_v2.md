# 📡 PR Status Monitor

[![Visual Studio Marketplace](https://shields.io)](https://visualstudio.com)
[![Installs](https://shields.io)](https://visualstudio.com)
[![License](https://shields.io)](https://github.com)

**Stop refreshing GitHub tabs.** Get real-time pull request CI/CD statuses, automated failure diagnostics, and native status bar navigation without changing context.

---

## ⚡ Quick Start (30 Seconds)

1. **Install** — Search for `PR Status Monitor` inside the VS Code Extensions Tab (`Ctrl+Shift+X`) and click **Install**.
2. **Authorize** — Approve the instant prompt to connect your account. Uses native secure VS Code GitHub authentication—**no personal access tokens required**.
3. **Run** — Open any folder with a Git repository. Your PR pipeline status aggregates right inside your bottom status bar.

---

## ✨ Primary Features

### 🚥 Combined Repository Tooltips & Status Bars

Instantly inspect the unified build parameters of all active pull requests you authored across multiple local worktrees or projects simultaneously.

- 🟢 **Passing** — Every continuous integration pipeline build passed.
- 🟠 **Pending** — Tests or automation runners actively building.
- 🔴 **Failed** — Attention required immediately.

### 🔔 Smart Notification Pipelines

Receive system alerts the millisecond your target pull request builds transition states. Every alert contains an internal action toggle button to jump straight to line errors.

### 🤖 Copilot Build Investigation

If a test runner fails, GitHub Copilot automatically initializes a direct chat workspace with pre-populated error telemetry data to instantly diagnose compilation logs without switching to web pages.

### 🖱️ Single-Click Global Navigation

Tap the status bar UI element at any time to explicitly open your active workspace development branch link in your default system web browser.

---

## ⚙️ Configuration Properties

Customize behavior inside your native `settings.json` panel:

```json
{
  "prStatusMonitor.pollingInterval": 2,
  "prStatusMonitor.showInvestigateOnFailure": true
}
```

| Property                                   | Type      | Default | Evaluation Description                                                      |
| :----------------------------------------- | :-------- | :------ | :-------------------------------------------------------------------------- |
| `prStatusMonitor.pollingInterval`          | `number`  | `2`     | Interval clock cycle matching cadence (in minutes). Min: 0.5, Max: 60.      |
| `prStatusMonitor.showInvestigateOnFailure` | `boolean` | `false` | Automatically initialize AI chat interface panels during build disruptions. |

---

## 🛠️ Environment Prerequisites

- **VS Code Engine:** Version `1.103.0` or higher.
- **Identity Provider:** Active GitHub profile access token session authenticated within the local client profile.

---

## 💝 Maintained By

Developed by [Avraham Hamu](https://visualstudio.com). If this tool helps clean up your workspace context context-switching, please consider dropping a ⭐ [Marketplace Rating](https://visualstudio.com) or starring the source repository!
