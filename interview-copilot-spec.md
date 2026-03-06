# Interview Copilot — Project Spec

A live interview assistant that listens to interview questions via your microphone, transcribes them in real time, and uses the Claude API to suggest concise answers you can speak naturally.

---

## Windows Compatibility

Yes, Windows is fully supported. All the recommended tools work on Windows:

- Node.js / Electron — native Windows support
- Whisper via Python — works on Windows (you'll need Python 3.10+)
- Claude API — HTTP, platform agnostic
- The only minor friction is that some Whisper CLI tools are smoother on Mac/Linux, but the OpenAI Whisper API (cloud) removes this entirely

---

## Architecture Overview

```
Microphone Input
      ↓
Speech-to-Text (Whisper)
      ↓
Transcribed Question Text
      ↓
Claude API (with system prompt context)
      ↓
Suggested Answer
      ↓
Electron Overlay UI (sits on top of your screen)
```

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Desktop shell | Electron | Cross-platform, renders HTML/CSS/JS, can overlay on screen |
| Speech-to-text | OpenAI Whisper API | Easiest on Windows, highly accurate, no local GPU needed |
| AI answers | Claude API (claude-sonnet-4-6) | Best reasoning, easy to tune via system prompt |
| Language | TypeScript | Consistent with your interview prep |
| Styling | Tailwind CSS | Fast to build a clean minimal UI |

### Alternative: Local Whisper (no API cost)
If you want fully offline STT, use `whisper.cpp` with Windows binaries — slightly more setup but free after install.

---

## Folder Structure

```
interview-copilot/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Bridge between Node and renderer
│   ├── renderer/
│   │   ├── index.html       # Overlay UI
│   │   ├── app.tsx          # React UI component
│   │   └── styles.css
│   ├── services/
│   │   ├── whisper.ts       # Whisper API calls
│   │   ├── claude.ts        # Claude API calls
│   │   └── recorder.ts      # Microphone capture
│   └── config/
│       └── systemPrompt.ts  # Your personalised context
├── package.json
├── tsconfig.json
└── electron-builder.json
```

---

## Core Implementation

### 1. Microphone Capture (`recorder.ts`)

Use the browser's native `MediaRecorder` API inside the Electron renderer — no extra dependencies needed on Windows.

```typescript
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start(1000); // collect chunks every 1s
  }

  stop(): Blob {
    this.mediaRecorder?.stop();
    return new Blob(this.chunks, { type: 'audio/webm' });
  }
}
```

### 2. Whisper Transcription (`whisper.ts`)

Send recorded audio to the Whisper API and return the transcribed text.

```typescript
export const transcribe = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
  });

  const data = await response.json();
  return data.text;
};
```

### 3. Claude Answer Generation (`claude.ts`)

Send the transcribed question to Claude with your personalised system prompt.

```typescript
export const getAnswer = async (question: string): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
};
```

### 4. System Prompt (`systemPrompt.ts`)

This is the most important part — personalise this thoroughly before your interview.

```typescript
export const SYSTEM_PROMPT = `
You are an interview assistant helping a Senior Blockchain Engineer in a live interview.

About the candidate:
- [YOUR NAME], X years experience
- Strong in: TypeScript, Solidity, ethers.js, React, Node.js
- Familiar with: wagmi, viem, hardhat, The Graph
- Previous roles: [add your roles]

The interview is for: Senior Blockchain Engineer - Fullstack

When given an interview question:
- Respond with 3-5 concise bullet points the candidate can speak naturally
- Use plain English, not overly technical jargon unless it adds value
- Lead with the most impressive/relevant point first
- If it is a coding question, give a brief approach and mention key concepts
- Keep total response under 150 words

Do not add preamble. Just give the bullet points.
`;
```

### 5. Electron Overlay (`main.ts`)

Create a transparent, always-on-top window that sits in the corner of your screen.

```typescript
import { app, BrowserWindow } from 'electron';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 450,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Position in bottom-right corner
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(width - 470, height - 620);

  win.loadFile('src/renderer/index.html');
};

app.whenReady().then(createWindow);
```

---

## UI Design (app.tsx)

Keep it minimal — dark background, low opacity so it's not distracting:

- **Top bar:** Record / Stop button + status indicator
- **Middle panel:** Live transcription of what's being said
- **Bottom panel:** Claude's suggested answer in bullet points
- **Opacity:** ~85% so you can see through it slightly to your CodePad

```
┌─────────────────────────────┐
│  🔴 Recording...    [Stop]  │
├─────────────────────────────┤
│ "Can you explain how curry  │
│  functions work in TypeSc..." │
├─────────────────────────────┤
│ • Curry converts a multi-   │
│   arg fn into chained fns   │
│ • Each fn closes over prev  │
│   args via closure          │
│ • Example: fn(a)(b) => ...  │
└─────────────────────────────┘
```

---

## Setup & Installation

```bash
# Prerequisites (Windows)
# - Node.js 18+ from nodejs.org
# - Python 3.10+ from python.org (only if using local Whisper)

git clone <your-repo>
cd interview-copilot
npm install

# Add your API keys to a .env file
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # only needed for Whisper API

npm run dev  # starts Electron in dev mode
```

---

## Environment Variables

Create a `.env` in the root:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Use `dotenv` in your main process to load these. Never commit this file.

---

## Potential Improvements (v2)

- **Hotkey trigger** — only send to Claude when you press a key, avoids transcribing filler words
- **Conversation history** — send last 3 Q&As to Claude for context continuity
- **Role-specific modes** — toggle between "blockchain", "general TypeScript", "behavioural" modes
- **Local Whisper** — remove OpenAI dependency entirely for privacy
- **Auto-detect question end** — detect silence > 2s to auto-submit rather than manual stop
- **Answer history panel** — scroll back through previous answers

---

## Estimated Build Time

| Phase | Time |
|---|---|
| Electron scaffold + overlay window | 1-2 hours |
| Microphone capture + Whisper integration | 1 hour |
| Claude API + system prompt tuning | 1 hour |
| UI (React + Tailwind) | 1-2 hours |
| **Total** | **4-6 hours** |

A working MVP is very achievable in a day.
