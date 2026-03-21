---
title: Mock Interviews
description: Practice interviews with AI-driven voice conversations
---

Mock interviews let you practice with an AI interviewer that uses your job description and resume to ask relevant questions.

## Creating a Session

1. Navigate to the **Mock Interview** page from the home screen
2. Paste a **job description** for the role you're targeting
3. Upload or paste your **resume**
4. Click **Start Interview**

The app verifies that required models are available (STT, LLM, TTS) before beginning.

## During the Interview

- The AI interviewer asks questions relevant to the job description
- Your responses are captured via speech-to-text
- Each turn is saved as audio (`user-turn-N.wav`) and feedback JSON (`turn-N.json`)
- A full markdown transcript is maintained in real time
- Conversation history is bounded to 30 turns to keep memory usage stable

## Reviewing Sessions

After completing an interview, click **Review** on any session to:

- Play back audio with synchronized per-turn feedback
- See ratings, comments, and context for each response
- View which job requirements and resume skills were matched

## Session Management

- Sessions show completion status (complete/incomplete) in the list
- Incomplete sessions can be resumed from where you left off
- If a provider fails mid-interview, progress is saved automatically so you can resume later

## Graceful Degradation

- If TTS is unavailable, the interview continues in text-only mode
- If any provider (STT, LLM, TTS) encounters an error, all progress is saved and you can resume later
