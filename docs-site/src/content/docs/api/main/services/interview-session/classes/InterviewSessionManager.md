---
editUrl: false
next: false
prev: false
title: "InterviewSessionManager"
---

Defined in: [main/services/interview-session.ts:9](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L9)

Manages persistent storage and retrieval of interview sessions on disk.

## Constructors

### Constructor

> **new InterviewSessionManager**(): `InterviewSessionManager`

Defined in: [main/services/interview-session.ts:10](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L10)

#### Returns

`InterviewSessionManager`

## Methods

### createSession()

> **createSession**(`jobDescription`, `resume`): `Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)\>

Defined in: [main/services/interview-session.ts:34](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L34)

Creates a new interview session with its directory structure and metadata.

#### Parameters

##### jobDescription

`string`

The job description for the interview.

##### resume

`string`

The candidate's resume text.

#### Returns

`Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)\>

The metadata for the newly created session.

***

### deleteAllSessions()

> **deleteAllSessions**(): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:264](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L264)

Deletes all saved interview sessions.

#### Returns

`Promise`\<`void`\>

***

### deleteSession()

> **deleteSession**(`sessionId`): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:252](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L252)

Deletes an interview session and all its associated files.

#### Parameters

##### sessionId

`string`

The session to delete.

#### Returns

`Promise`\<`void`\>

***

### getSession()

> **getSession**(`sessionId`): `Promise`\<[`InterviewSession`](/Mooch/api/shared/types/interfaces/interviewsession/) \| `null`\>

Defined in: [main/services/interview-session.ts:102](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L102)

Loads a complete interview session including transcript, feedback, and summary.

#### Parameters

##### sessionId

`string`

The unique session identifier.

#### Returns

`Promise`\<[`InterviewSession`](/Mooch/api/shared/types/interfaces/interviewsession/) \| `null`\>

The full session data, or null if not found.

***

### listSessions()

> **listSessions**(): `Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)[]\>

Defined in: [main/services/interview-session.ts:69](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L69)

Lists all saved interview sessions sorted by creation date (newest first).

#### Returns

`Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)[]\>

An array of session metadata objects.

***

### markComplete()

> **markComplete**(`sessionId`): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:237](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L237)

Marks an interview session as complete in its metadata.

#### Parameters

##### sessionId

`string`

The session to mark as complete.

#### Returns

`Promise`\<`void`\>

***

### saveAudio()

> **saveAudio**(`sessionId`, `turn`, `audioBuffer`): `Promise`\<`string`\>

Defined in: [main/services/interview-session.ts:208](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L208)

Saves a user's audio recording for a specific interview turn.

#### Parameters

##### sessionId

`string`

The session to save audio for.

##### turn

`number`

The turn number.

##### audioBuffer

`Buffer`

The raw audio data to save.

#### Returns

`Promise`\<`string`\>

The file path where the audio was saved.

***

### saveFeedback()

> **saveFeedback**(`sessionId`, `feedback`): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:154](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L154)

Saves feedback for a specific turn in an interview session.

#### Parameters

##### sessionId

`string`

The session to save feedback for.

##### feedback

[`InterviewFeedback`](/Mooch/api/shared/types/interfaces/interviewfeedback/)

The feedback data including rating and comments.

#### Returns

`Promise`\<`void`\>

***

### saveQuestionAudio()

> **saveQuestionAudio**(`sessionId`, `turn`, `audioBuffer`): `Promise`\<`string`\>

Defined in: [main/services/interview-session.ts:224](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L224)

Saves the TTS-generated question audio for a specific interview turn.

#### Parameters

##### sessionId

`string`

The session to save audio for.

##### turn

`number`

The turn number.

##### audioBuffer

`Buffer`

The raw audio data to save.

#### Returns

`Promise`\<`string`\>

The file path where the audio was saved.

***

### saveSummary()

> **saveSummary**(`sessionId`, `summary`): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:173](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L173)

Saves the overall interview summary and caches the average rating in metadata.

#### Parameters

##### sessionId

`string`

The session to save the summary for.

##### summary

[`InterviewSummary`](/Mooch/api/shared/types/interfaces/interviewsummary/)

The interview summary with ratings and areas of improvement.

#### Returns

`Promise`\<`void`\>

***

### saveTranscript()

> **saveTranscript**(`sessionId`, `transcript`): `Promise`\<`void`\>

Defined in: [main/services/interview-session.ts:188](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/interview-session.ts#L188)

Saves or updates the interview transcript markdown file.

#### Parameters

##### sessionId

`string`

The session to save the transcript for.

##### transcript

`string`

The full transcript content in markdown format.

#### Returns

`Promise`\<`void`\>
