---
title: Installation
description: How to install and run Mooch
---

## Download

Pre-built binaries are available from [GitHub Releases](https://github.com/dweng0/Mooch/releases) for Linux, macOS, and Windows.

## Build from Source

### Prerequisites

- Node.js 18+
- npm

### Steps

```bash
# Clone the repository
git clone https://github.com/dweng0/Mooch.git
cd Mooch

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for your platform
npm run package:linux   # Linux (.AppImage)
npm run package:mac     # macOS (.dmg)
npm run package:win     # Windows (.exe)
```

## Configuration

On first launch, head to **Settings** to configure your AI providers. You'll need at least one LLM provider configured to use mock interviews or code hints.

See the [Providers guide](/Mooch/guides/providers/) for details on setting up each provider type.
