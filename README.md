# 📡 PR Status Monitor

[![Visual Studio Code](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.8-brightgreen.svg)]()
[![GitHub License](https://img.shields.io/badge/license-MIT-lightgrey.svg)]()

**PR Status Monitor** is a sleek, intelligent VS Code extension that keeps you intimately connected to your GitHub Pull Requests directly from your editor's status bar. Instead of context-switching to your browser, get instant visual feedback on whether your CI/CD checks have passed, failed, or are still pending!

## ✨ Features

- **🚀 Universal Worktree Support:** Accurately aggregates and tracks all PRs you have authored across all active repositories and unique worktrees opened in your VS Code workspace.
- **🚥 Real-time CI Integration:** Reads GitHub Actions and Commit Statuses to color-code your PRs:
  - 🟢 **Passing:** Everything is good to go!
  - 🟠 **Pending:** Checks are still running.
  - 🔴 **Failed:** Action required (check logs for failures, timeouts, etc.).
- **🖱️ One-Click Navigation:** Click the status bar widget to instantly jump straight to your latest active PR in your default web browser.
- **📊 Detailed Tooltips:** Hover over the status bar item to see an organized list of all your open PRs along with their specific build status.

## 🛠️ Usage

Once installed, the PR Status Monitor automatically activates on startup.
It seamlessly authenticates with your built-in VS Code GitHub account. You'll see an icon appearing in the lower-left corner of your status bar indicating:

`3 PRs | 🟢1 🔴1 🟠1`

_(Example: 3 Open PRs total. 1 Passing, 1 Failed, 1 Pending)._

**Note:** The extension queries GitHub securely and pulls updates automatically every **2 minutes** by default.

## ⚙️ Configuration

You can customize the polling interval in VS Code settings:

- **`prStatusMonitor.pollingInterval`** _(number, default: `2`)_
  How often to check PR status, in minutes. Minimum: 1, Maximum: 60.

  To change it:
  1. Open Settings (`Cmd+,` or `Ctrl+,`)
  2. Search for "PR Status Monitor"
  3. Adjust the "Polling Interval" value

  Or add to your `settings.json`:
  ```json
  {
    "prStatusMonitor.pollingInterval": 5
  }
  ```

## 📋 Requirements

- VS Code version `^1.103.0`
- You must be signed in to GitHub within VS Code.

## 👨‍💻 Author

Created with ❤️ by **Avraham Hamu**.

---

_If you find this extension helpful, please share it with your team or open an issue on the repository!_
