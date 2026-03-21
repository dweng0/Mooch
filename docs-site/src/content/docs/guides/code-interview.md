---
title: Code Interview Mode
description: Get real-time hints during coding challenges
---

Code Interview Mode connects Mooch to your browser via a Chrome extension, giving you real-time hints while working on coding challenges.

## How It Works

1. Click **Code Interview** from the Mooch home screen
2. The app starts a local bridge API server on `localhost:62544`
3. A waiting screen appears until the Chrome extension connects
4. Once connected, the dashboard shows your current problem, detected language, live code preview, and a scrollable hint history

## The Dashboard

When the extension is connected and sending code updates, the dashboard displays:

- **Problem title** — extracted from the page by the extension
- **Programming language** — auto-detected
- **Live code preview** — updated as you type
- **Hint history** — all generated hints in a scrollable list

## Interview Context

If you started Code Interview Mode from within an active mock interview session, hints are enriched with your job description and resume context. The dashboard shows which interview session is providing context.

## Disconnection Handling

If the browser is closed or the extension is disabled:

- The dashboard reverts to the waiting state after a timeout
- A message indicates the connection was lost
- Hint history from the session is preserved

## Stopping

Click the back button or exit code interview mode. The bridge API server stops and you return to the home screen.
