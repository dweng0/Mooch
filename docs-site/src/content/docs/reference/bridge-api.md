---
title: Bridge API
description: Local HTTP API for Chrome extension integration
---

The Mooch Bridge API is a local HTTP server that enables communication between the Chrome extension and the Mooch desktop app.

## Overview

- **Base URL:** `http://localhost:62544`
- **Content-Type:** `application/json`
- **Required header:** `X-Mooch-Client: chrome-extension`
- **Binding:** `127.0.0.1` only (never `0.0.0.0`)
- **CORS:** Allows `chrome-extension://*` origins

Requests without the `X-Mooch-Client` header or from non-localhost origins are rejected with `403`.

## Endpoints

### `GET /health`

Check if Mooch is running and whether an interview session is active.

**Response `200`:**
```json
{
  "status": "ok",
  "version": "string",
  "activeSession": "string | null"
}
```

### `GET /api/providers`

List configured providers. API keys and secrets are never exposed.

**Response `200`:**
```json
{
  "providers": [
    {
      "name": "string",
      "type": "anthropic | openai-compatible",
      "configured": true
    }
  ]
}
```

### `POST /api/hint`

Request a hint for the current code.

**Request:**
```json
{
  "code": "string",
  "pageTitle": "string",
  "language": "string | null",
  "metadata": {
    "difficulty": "string | null",
    "tags": ["string"],
    "constraints": "string | null"
  },
  "hintStyle": "gentle | detailed | pseudocode"
}
```

**Response `200`:**
```json
{
  "hint": "string"
}
```

**Response `503`:**
```json
{
  "error": "no provider configured"
}
```

If an interview session is active, the server automatically appends the job description and resume to the LLM context.

### `POST /api/analyze`

Request code analysis.

**Request:**
```json
{
  "code": "string",
  "context": "string | null"
}
```

**Response `200`:**
```json
{
  "analysis": "string"
}
```

**Response `503`:**
```json
{
  "error": "no provider configured"
}
```
