---
title: Chrome Extension
description: Install and use the Mooch Helper browser extension
---

The Mooch Helper Chrome extension extracts code and problem context from coding challenge websites and sends it to the Mooch desktop app for analysis.

## Installation

The extension is available from the [GitHub repository](https://github.com/dweng0/Mooch). Install it as an unpacked extension in Chrome:

1. Download or clone the extension source
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select the extension directory

## Usage

1. Start **Code Interview Mode** in Mooch (the desktop app)
2. Navigate to a coding challenge in Chrome
3. The extension detects the coding problem and sends code to Mooch
4. Hints appear on the Mooch dashboard in real time

## How It Communicates

The extension communicates with Mooch via a local HTTP API on `localhost:62544`. It sends:

- `GET /health` — to check if Mooch is running
- `POST /api/hint` — to request hints with the current code, page title, and language
- `POST /api/analyze` — to request code analysis

All requests include the `X-Mooch-Client: chrome-extension` header. See the [Bridge API reference](/Mooch/reference/bridge-api/) for full details.
