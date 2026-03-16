# Issue Templates for Mooch Project

Copy these into GitHub issues (via CLI or web UI) as needed.

---

## 🧪 Issue 1: Add Integration Tests for Full Audio Pipeline

**Title:** `Add integration tests for audio → LLM → TTS flow`  
**Labels:** `test, enhancement, priority`  
**Priority:** High ⚠️

### Background
Currently we have good unit test coverage (~2K lines across test files), but there's a gap in testing the complete end-to-end pipeline from audio capture through LLM processing to TTS output.

### What Needs Testing
- [ ] Microphone input → STT processing verification
- [ ] LLM response generation with various inputs
- [ ] TTS output streaming and buffer handling
- [ ] Error recovery during playback interruptions
- [ ] Audio format compatibility (WAV/MP3/WebM)

### Test Scenarios
1. Long-form interview (> 30 minutes) without memory issues
2. Rapid-fire questions (high frequency input/output)
3. Network interruption and recovery
4. TTS provider fallback behavior
5. Concurrent audio capture/playback

### Acceptance Criteria
- [ ] New integration test suite in `src/test/integration/`
- [ ] Mock LLM responses for deterministic testing
- [ ] Performance benchmarks for 10+ minute sessions
- [ ] CI/CD pipeline integration for auto-testing

---

## 💾 Issue 2: Implement Conversation History Memory Limits

**Title:** `Implement conversation history memory limits`  
**Labels:** `bug, performance, enhancement`  
**Priority:** Medium ⚡

### Background
The `conversationHistory` array in `InterviewOrchestrator.ts` can grow unbounded over long interview sessions. This could lead to:
- Memory exhaustion in extended interviews
- Increased latency as LLM context grows
- Suboptimal response quality from token limits

### Current Implementation
```typescript
private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
```

### Proposed Solutions
1. **Rolling Window**: Limit to last N turns (e.g., 20-30)
2. **Summarization**: Summarize older conversations periodically
3. **Database Offload**: Store history in persistent storage
4. **Hybrid Approach**: Keep recent messages, summary of older ones

### Acceptance Criteria
- [ ] Memory usage remains stable over 60+ minute sessions
- [ ] LLM response latency stays under acceptable threshold
- [ ] Conversation quality not degraded by history truncation
- [ ] Implementation documented with trade-offs explained

---

## 📊 Issue 3: Add Interview Metrics and Analytics Logging

**Title:** `Add interview metrics and analytics logging`  
**Labels:** `feature, monitoring, analytics`  
**Priority:** Low 🐌

### Background
We need structured metrics to track interview performance, LLM usage, audio quality, and system health for debugging and optimization.

### Proposed Metrics to Track
1. **Session Metrics**
   - Total duration
   - Number of turns/questions
   - Completion status (complete/incomplete)
   - Average response time per turn

2. **LLM Usage Metrics**
   - Tokens consumed per turn
   - Provider selection frequency
   - Fallback rates to different providers
   - Response generation latency

3. **Audio Quality Metrics**
   - STT confidence scores
   - TTS streaming quality indicators
   - Audio format compatibility stats
   - Playback error rates

4. **System Health**
   - Memory usage over time
   - API call success/failure rates
   - Network connectivity status
   - Device performance indicators

### Acceptance Criteria
- [ ] Metrics exported to structured format (JSON/CSV)
- [ ] Dashboard or summary view in UI (optional)
- [ ] Export functionality for analysis
- [ ] Privacy-compliant (anonymized user data)

---

## ⚡ Issue 4: Move Heavy Audio Processing to Web Workers

**Title:** `Move heavy audio processing to Web Workers`  
**Labels:** `performance, refactor, optimization`  
**Priority:** Low 🐌

### Background
Audio processing (STT, TTS buffering, format conversion) currently runs on the main thread, which can cause:
- UI stuttering during intensive operations
- Audio glitches due to buffer underruns/overruns
- Poor user experience in real-time scenarios

### What Needs Offloading
1. **Speech-to-Text Processing** - Run Whisper/STT model in worker
2. **Audio Buffer Management** - Handle audio queues and playback timing
3. **Format Conversion** - WAV ↔ MP3/WebM conversions
4. **LLM Response Parsing** - JSON parsing, text transformation

### Proposed Architecture
```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Main Thread  │ ◄──►   │     Web Workers    │  │ TTS Provider │
│  (UI/IPC)      │      │ STT Worker   │  │  (Optional)  │
└─────────────┘      └──────────────┘      └─────────────┘
                      ┌──────────────┐
                      │ LLM Worker   │
                      └──────────────┘
```

### Acceptance Criteria
- [ ] UI remains responsive during audio processing
- [ ] No blocking calls to main thread from workers
- [ ] Cross-worker communication handled efficiently
- [ ] Memory isolation prevents worker crashes from affecting main thread
- [ ] Worker lifecycle managed (spawn/detach) properly

---

## 📋 How to Create These Issues

### Via GitHub CLI:
```bash
# Issue 1: Integration Tests
gh issue create \
  --title "Add integration tests for audio → LLM → TTS flow" \
  --labels "test,enhancement,priority" \
  --body "$(cat /path/to/issue-1.md)"

# Issue 2: Memory Limits
gh issue create \
  --title "Implement conversation history memory limits" \
  --labels "bug,performance,enhancement" \
  --body "$(cat /path/to/issue-2.md)"

# etc...
```

### Via GitHub Web UI:
1. Go to your repo on GitHub.com
2. Click **Issues** → **New Issue**
3. Copy and paste the relevant section above
4. Set priority by adding emoji or custom label

---

## 📝 Notes
- Prioritize Issue 1 (Integration Tests) as it's most critical
- Issues 2 & 3 can be tackled in parallel
- Issue 4 is optional optimization work
- Consider creating a project board to track progress
