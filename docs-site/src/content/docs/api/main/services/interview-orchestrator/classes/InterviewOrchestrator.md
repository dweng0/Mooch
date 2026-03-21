---
editUrl: false
next: false
prev: false
title: "InterviewOrchestrator"
---

Defined in: [main/services/interview-orchestrator.ts:28](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L28)

Orchestrates real-time voice interviews, managing LLM interactions, TTS, and session state.

## Constructors

### Constructor

> **new InterviewOrchestrator**(`sessionManager`, `ttsManager`): `InterviewOrchestrator`

Defined in: [main/services/interview-orchestrator.ts:41](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L41)

Creates a new interview orchestrator.

#### Parameters

##### sessionManager

[`InterviewSessionManager`](/Mooch/api/main/services/interview-session/classes/interviewsessionmanager/)

The session manager for persisting interview data.

##### ttsManager

[`TTSProviderManager`](/Mooch/api/main/services/tts-provider/classes/ttsprovidermanager/)

The TTS provider manager for speech synthesis.

#### Returns

`InterviewOrchestrator`

## Methods

### endInterview()

> **endInterview**(`isComplete?`): `Promise`\<`void`\>

Defined in: [main/services/interview-orchestrator.ts:199](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L199)

Ends the current interview session and resets orchestrator state.

#### Parameters

##### isComplete?

`boolean` = `true`

Whether the interview completed normally (defaults to true).

#### Returns

`Promise`\<`void`\>

***

### generateOpener()

> **generateOpener**(): `Promise`\<`string`\>

Defined in: [main/services/interview-orchestrator.ts:267](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L267)

Generates the opening interview question based on the job description and resume.

#### Returns

`Promise`\<`string`\>

The opening question text.

***

### generateSummary()

> **generateSummary**(`sessionId`): `Promise`\<[`InterviewSummary`](/Mooch/api/shared/types/interfaces/interviewsummary/)\>

Defined in: [main/services/interview-orchestrator.ts:220](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L220)

Generates an AI-powered summary of the interview with ratings, strengths, and improvement areas.

#### Parameters

##### sessionId

`string`

The session to generate a summary for.

#### Returns

`Promise`\<[`InterviewSummary`](/Mooch/api/shared/types/interfaces/interviewsummary/)\>

The interview summary with average rating and feedback areas.

***

### getConversationHistory()

> **getConversationHistory**(): `object`[]

Defined in: [main/services/interview-orchestrator.ts:465](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L465)

Returns a copy of the conversation history.

#### Returns

`object`[]

An array of conversation messages with role and content.

***

### getCurrentTurn()

> **getCurrentTurn**(): `number`

Defined in: [main/services/interview-orchestrator.ts:457](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L457)

Returns the current turn number in the interview.

#### Returns

`number`

The current turn number.

***

### getSessionId()

> **getSessionId**(): `string` \| `null`

Defined in: [main/services/interview-orchestrator.ts:152](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L152)

Returns the current active session ID.

#### Returns

`string` \| `null`

The session ID, or null if no interview is active.

***

### processUserResponse()

> **processUserResponse**(`userText`, `audioPath?`): `Promise`\<[`InterviewTurn`](/Mooch/api/shared/types/interfaces/interviewturn/)\>

Defined in: [main/services/interview-orchestrator.ts:82](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L82)

Processes a user's response, generates feedback and the next interview question.

#### Parameters

##### userText

`string`

The transcribed text of the user's spoken response.

##### audioPath?

`string`

Optional path to the saved audio file.

#### Returns

`Promise`\<[`InterviewTurn`](/Mooch/api/shared/types/interfaces/interviewturn/)\>

The interview turn data including the next question and feedback.

***

### saveQuestionAudio()

> **saveQuestionAudio**(`audioBuffer`): `Promise`\<`void`\>

Defined in: [main/services/interview-orchestrator.ts:160](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L160)

Saves the TTS-generated question audio for the current turn.

#### Parameters

##### audioBuffer

`Buffer`

The raw audio data to save.

#### Returns

`Promise`\<`void`\>

***

### saveUserAudio()

> **saveUserAudio**(`audioBuffer`): `Promise`\<`void`\>

Defined in: [main/services/interview-orchestrator.ts:179](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L179)

Saves the user's recorded audio for the current turn.

#### Parameters

##### audioBuffer

`Buffer`

The raw audio data to save.

#### Returns

`Promise`\<`void`\>

***

### startRealTimeVoiceInterview()

> **startRealTimeVoiceInterview**(`config`): `Promise`\<`void`\>

Defined in: [main/services/interview-orchestrator.ts:50](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-orchestrator.ts#L50)

Initializes a new real-time voice interview session with the given configuration.

#### Parameters

##### config

[`InterviewConfig`](/Mooch/api/main/services/interview-orchestrator/interfaces/interviewconfig/)

The interview configuration including session ID, LLM provider, and TTS settings.

#### Returns

`Promise`\<`void`\>
