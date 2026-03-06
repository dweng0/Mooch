# Unit Tests

This project includes comprehensive unit tests for the Electron app's core functionality, particularly around microphone usage, screen/window capture, and data packaging for the backend.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### 1. AudioRecorder Tests (`src/renderer/src/services/recorder.test.ts`)

Tests for microphone and system audio recording:

- **Microphone Recording**
  - Starting recording from microphone
  - Handling permission denied errors
  - Handling missing microphone device
  - Recording state tracking

- **Audio Data Collection**
  - Collecting audio chunks during recording
  - Handling empty chunks
  - Converting recorded data to ArrayBuffer

- **Stop Recording**
  - Cleanup of resources (streams, tracks)
  - Error handling when not recording
  - State management

- **System Audio Recording**
  - Desktop source selection
  - Video track removal from screen capture
  - Permission handling

- **Audio Format**
  - Correct MIME type (audio/webm;codecs=opus)
  - Proper blob creation with encoding

### 2. Screen/Window Capture Tests (`src/main/services/capture.test.ts`)

Tests for screen and window snapshot functionality:

- **Screen Capture**
  - Full screen capture
  - Base64 PNG encoding
  - Error handling for missing sources

- **Window Capture**
  - Capturing specific windows by ID
  - Window list with thumbnails
  - Handling window not found scenarios

- **Screen Area Capture**
  - Cropping specific regions
  - Scale factor handling for HiDPI displays
  - Coordinate transformation

- **Image Encoding**
  - PNG format validation
  - Base64 encoding for transmission

- **Caching**
  - Window source caching (30 second TTL)
  - Cache invalidation

### 3. API Client Tests (`src/main/services/api-client.test.ts`)

Tests for data packaging sent to the backend:

- **Authentication**
  - Login credential packaging
  - Session token management
  - Authorization header inclusion

- **Audio Transcription**
  - Audio buffer to base64 conversion
  - Various buffer sizes
  - Transcript response handling

- **Code Snapshot Analysis**
  - Image base64 packaging
  - Context inclusion
  - Explanation response handling

- **Question Answering**
  - Question + provider + context packaging
  - Multiple text files handling
  - Empty context handling
  - Complex context with all fields

- **Error Handling**
  - 401 response handling (session clearing)
  - Error message propagation
  - Network error handling

- **Data Serialization**
  - Complex nested objects
  - Special characters (newlines, quotes, tabs)
  - Binary data in base64

## What Gets Packaged to the Backend

### Audio Data
- Format: ArrayBuffer converted to base64 string
- MIME type: audio/webm;codecs=opus
- Sent to: `/api/copilot/transcribe`

### Code Snapshots
- Format: PNG image as base64 string
- Optional context: text description
- Sent to: `/api/copilot/code-snapshot`

### Questions with Context
- question: string
- provider: AIProvider ('openai' | 'anthropic' | 'google')
- context: UserContext object containing:
  - textFiles: array of {name, content}
  - audioTranscript: string (optional)
  - codeSnapshot: {imageBase64, context} (optional)
- Sent to: `/api/copilot/answer`

## Test Configuration

- **Framework**: Vitest
- **Environment**: happy-dom (for browser APIs)
- **Coverage**: V8 provider
- **Setup**: `vitest.setup.ts` (mocks for Electron, MediaRecorder, Blob, etc.)
- **Config**: `vitest.config.ts`

## Key Mocks

The test setup includes mocks for:
- `MediaRecorder` - Browser audio recording API
- `navigator.mediaDevices.getUserMedia` - Microphone/camera access
- `electron.desktopCapturer` - Screen/window capture
- `electron.screen` - Display information
- `electronAPI` - IPC communication bridge
- `fetch` - HTTP requests to backend
