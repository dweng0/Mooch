---
editUrl: false
next: false
prev: false
title: "ElectronAPI"
---

Defined in: [shared/types.ts:125](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L125)

## Properties

### analyzeCodeSnapshot

> **analyzeCodeSnapshot**: (`imageBase64`, `context?`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:141](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L141)

#### Parameters

##### imageBase64

`string`

##### context?

`string`

#### Returns

`Promise`\<`string`\>

***

### captureScreen

> **captureScreen**: () => `Promise`\<`string`\>

Defined in: [shared/types.ts:142](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L142)

#### Returns

`Promise`\<`string`\>

***

### captureScreenArea

> **captureScreenArea**: (`rect`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:146](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L146)

#### Parameters

##### rect

[`CropRect`](/Mooch/api/shared/types/interfaces/croprect/)

#### Returns

`Promise`\<`string`\>

***

### captureWindow

> **captureWindow**: (`sourceId`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:144](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L144)

#### Parameters

##### sourceId

`string`

#### Returns

`Promise`\<`string`\>

***

### clearApiKey

> **clearApiKey**: (`provider`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:158](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L158)

#### Parameters

##### provider

`"openai"` \| `"gemini"` \| `"qwen"` \| `"anthropic"` \| `"cosyvoice"`

#### Returns

`Promise`\<`void`\>

***

### clearCustomProvider

> **clearCustomProvider**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:168](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L168)

#### Returns

`Promise`\<`void`\>

***

### clearLocalStt

> **clearLocalStt**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:163](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L163)

#### Returns

`Promise`\<`void`\>

***

### clearLocalTts

> **clearLocalTts**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:160](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L160)

#### Returns

`Promise`\<`void`\>

***

### completeAreaSelection

> **completeAreaSelection**: (`rect`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:147](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L147)

#### Parameters

##### rect

[`CropRect`](/Mooch/api/shared/types/interfaces/croprect/) \| `null`

#### Returns

`Promise`\<`void`\>

***

### getAnswer

> **getAnswer**: (`question`, `provider`, `context`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:138](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L138)

#### Parameters

##### question

`string`

##### provider

[`AIProvider`](/Mooch/api/shared/types/type-aliases/aiprovider/)

##### context

[`UserContext`](/Mooch/api/shared/types/interfaces/usercontext/)

#### Returns

`Promise`\<`string`\>

***

### getApiKeys

> **getApiKeys**: () => `Promise`\<[`UserApiKeys`](/Mooch/api/shared/types/interfaces/userapikeys/)\>

Defined in: [shared/types.ts:156](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L156)

#### Returns

`Promise`\<[`UserApiKeys`](/Mooch/api/shared/types/interfaces/userapikeys/)\>

***

### getApiUrl

> **getApiUrl**: () => `Promise`\<`string`\>

Defined in: [shared/types.ts:154](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L154)

#### Returns

`Promise`\<`string`\>

***

### getAppVersion

> **getAppVersion**: () => `Promise`\<`string`\>

Defined in: [shared/types.ts:153](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L153)

#### Returns

`Promise`\<`string`\>

***

### getAuthStatus

> **getAuthStatus**: () => `Promise`\<[`AuthStatus`](/Mooch/api/shared/types/interfaces/authstatus/)\>

Defined in: [shared/types.ts:129](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L129)

#### Returns

`Promise`\<[`AuthStatus`](/Mooch/api/shared/types/interfaces/authstatus/)\>

***

### getAvailableProviders

> **getAvailableProviders**: () => `Promise`\<[`AIProvider`](/Mooch/api/shared/types/type-aliases/aiprovider/)[]\>

Defined in: [shared/types.ts:139](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L139)

#### Returns

`Promise`\<[`AIProvider`](/Mooch/api/shared/types/type-aliases/aiprovider/)[]\>

***

### getDesktopSourceId

> **getDesktopSourceId**: () => `Promise`\<`string`\>

Defined in: [shared/types.ts:149](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L149)

#### Returns

`Promise`\<`string`\>

***

### getInterviewProviders

> **getInterviewProviders**: (`preferredLlm?`) => `Promise`\<\{ `llm`: `string` \| `null`; `stt`: `string` \| `null`; `tts`: `string` \| `null`; \}\>

Defined in: [shared/types.ts:140](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L140)

#### Parameters

##### preferredLlm?

`string`

#### Returns

`Promise`\<\{ `llm`: `string` \| `null`; `stt`: `string` \| `null`; `tts`: `string` \| `null`; \}\>

***

### getWindowSources

> **getWindowSources**: () => `Promise`\<[`WindowSource`](/Mooch/api/shared/types/interfaces/windowsource/)[]\>

Defined in: [shared/types.ts:143](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L143)

#### Returns

`Promise`\<[`WindowSource`](/Mooch/api/shared/types/interfaces/windowsource/)[]\>

***

### interviewCreateSession

> **interviewCreateSession**: (`jobDescription`, `resume`) => `Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)\>

Defined in: [shared/types.ts:175](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L175)

#### Parameters

##### jobDescription

`string`

##### resume

`string`

#### Returns

`Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)\>

***

### interviewDeleteAllSessions

> **interviewDeleteAllSessions**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:182](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L182)

#### Returns

`Promise`\<`void`\>

***

### interviewDeleteSession

> **interviewDeleteSession**: (`sessionId`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:181](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L181)

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

***

### interviewEndSession

> **interviewEndSession**: (`sessionId`, `isComplete`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:180](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L180)

#### Parameters

##### sessionId

`string`

##### isComplete

`boolean`

#### Returns

`Promise`\<`void`\>

***

### interviewGenerateOpener

> **interviewGenerateOpener**: (`sessionId`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:178](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L178)

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`string`\>

***

### interviewGetAudio

> **interviewGetAudio**: (`sessionId`, `turn`, `type`) => `Promise`\<`ArrayBuffer` \| `null`\>

Defined in: [shared/types.ts:184](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L184)

#### Parameters

##### sessionId

`string`

##### turn

`number`

##### type

`"question"` \| `"response"`

#### Returns

`Promise`\<`ArrayBuffer` \| `null`\>

***

### interviewGetSession

> **interviewGetSession**: (`sessionId`) => `Promise`\<[`InterviewSession`](/Mooch/api/shared/types/interfaces/interviewsession/) \| `null`\>

Defined in: [shared/types.ts:177](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L177)

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`InterviewSession`](/Mooch/api/shared/types/interfaces/interviewsession/) \| `null`\>

***

### interviewListSessions

> **interviewListSessions**: () => `Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)[]\>

Defined in: [shared/types.ts:176](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L176)

#### Returns

`Promise`\<[`InterviewSessionMetadata`](/Mooch/api/shared/types/interfaces/interviewsessionmetadata/)[]\>

***

### interviewProcessTurn

> **interviewProcessTurn**: (`sessionId`, `userText`) => `Promise`\<[`InterviewTurn`](/Mooch/api/shared/types/interfaces/interviewturn/)\>

Defined in: [shared/types.ts:179](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L179)

#### Parameters

##### sessionId

`string`

##### userText

`string`

#### Returns

`Promise`\<[`InterviewTurn`](/Mooch/api/shared/types/interfaces/interviewturn/)\>

***

### interviewSynthesize

> **interviewSynthesize**: (`text`) => `Promise`\<`ArrayBuffer` \| `null`\>

Defined in: [shared/types.ts:183](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L183)

#### Parameters

##### text

`string`

#### Returns

`Promise`\<`ArrayBuffer` \| `null`\>

***

### loadTextFile

> **loadTextFile**: () => `Promise`\<\{ `content`: `string`; `name`: `string`; \} \| `null`\>

Defined in: [shared/types.ts:150](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L150)

#### Returns

`Promise`\<\{ `content`: `string`; `name`: `string`; \} \| `null`\>

***

### login

> **login**: (`email`, `password`) => `Promise`\<[`AuthStatus`](/Mooch/api/shared/types/interfaces/authstatus/) \| `null`\>

Defined in: [shared/types.ts:127](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L127)

#### Parameters

##### email

`string`

##### password

`string`

#### Returns

`Promise`\<[`AuthStatus`](/Mooch/api/shared/types/interfaces/authstatus/) \| `null`\>

***

### logout

> **logout**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:128](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L128)

#### Returns

`Promise`\<`void`\>

***

### onAuthStatusUpdate

> **onAuthStatusUpdate**: (`callback`) => () => `void`

Defined in: [shared/types.ts:135](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L135)

#### Parameters

##### callback

(`status`) => `void`

#### Returns

() => `void`

***

### onHotkeyRecordStart

> **onHotkeyRecordStart**: (`callback`) => () => `void`

Defined in: [shared/types.ts:172](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L172)

#### Parameters

##### callback

() => `void`

#### Returns

() => `void`

***

### onHotkeyRecordStop

> **onHotkeyRecordStop**: (`callback`) => () => `void`

Defined in: [shared/types.ts:173](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L173)

#### Parameters

##### callback

() => `void`

#### Returns

() => `void`

***

### onOAuthSuccess

> **onOAuthSuccess**: (`callback`) => () => `void`

Defined in: [shared/types.ts:134](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L134)

#### Parameters

##### callback

(`user`) => `void`

#### Returns

() => `void`

***

### openExternalUrl

> **openExternalUrl**: (`url`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:132](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L132)

#### Parameters

##### url

`string`

#### Returns

`Promise`\<`void`\>

***

### openManageSubscription

> **openManageSubscription**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:131](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L131)

#### Returns

`Promise`\<`void`\>

***

### openOAuth

> **openOAuth**: (`provider`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:133](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L133)

#### Parameters

##### provider

[`OAuthProvider`](/Mooch/api/shared/types/type-aliases/oauthprovider/)

#### Returns

`Promise`\<`void`\>

***

### openSubscribe

> **openSubscribe**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:130](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L130)

#### Returns

`Promise`\<`void`\>

***

### quitApp

> **quitApp**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:152](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L152)

#### Returns

`Promise`\<`void`\>

***

### restartApp

> **restartApp**: () => `Promise`\<`void`\>

Defined in: [shared/types.ts:151](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L151)

#### Returns

`Promise`\<`void`\>

***

### setApiKey

> **setApiKey**: (`provider`, `apiKey`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:157](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L157)

#### Parameters

##### provider

`"openai"` \| `"gemini"` \| `"qwen"` \| `"anthropic"` \| `"cosyvoice"`

##### apiKey

`string`

#### Returns

`Promise`\<`void`\>

***

### setCustomProvider

> **setCustomProvider**: (`config`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:167](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L167)

#### Parameters

##### config

[`CustomProviderConfig`](/Mooch/api/shared/types/interfaces/customproviderconfig/)

#### Returns

`Promise`\<`void`\>

***

### setLocalStt

> **setLocalStt**: (`url`, `model?`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:162](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L162)

#### Parameters

##### url

`string`

##### model?

`string`

#### Returns

`Promise`\<`void`\>

***

### setLocalTts

> **setLocalTts**: (`url`, `model?`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:159](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L159)

#### Parameters

##### url

`string`

##### model?

`string`

#### Returns

`Promise`\<`void`\>

***

### setQwenModel

> **setQwenModel**: (`model`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:165](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L165)

#### Parameters

##### model

`string`

#### Returns

`Promise`\<`void`\>

***

### setSttProvider

> **setSttProvider**: (`provider`) => `Promise`\<`void`\>

Defined in: [shared/types.ts:169](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L169)

#### Parameters

##### provider

`"openai"` \| `"gemini"` \| `"qwen"` \| `"custom"` \| `"local"` \| `null`

#### Returns

`Promise`\<`void`\>

***

### startAreaSelection

> **startAreaSelection**: () => `Promise`\<[`CropRect`](/Mooch/api/shared/types/interfaces/croprect/) \| `null`\>

Defined in: [shared/types.ts:145](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L145)

#### Returns

`Promise`\<[`CropRect`](/Mooch/api/shared/types/interfaces/croprect/) \| `null`\>

***

### testCustomProvider

> **testCustomProvider**: (`config`) => `Promise`\<\{ `reasoning`: `boolean`; `stt`: `boolean`; \}\>

Defined in: [shared/types.ts:170](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L170)

#### Parameters

##### config

[`CustomProviderConfig`](/Mooch/api/shared/types/interfaces/customproviderconfig/)

#### Returns

`Promise`\<\{ `reasoning`: `boolean`; `stt`: `boolean`; \}\>

***

### testLocalStt

> **testLocalStt**: (`url`, `model?`) => `Promise`\<\{ `message`: `string`; `ok`: `boolean`; \}\>

Defined in: [shared/types.ts:164](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L164)

#### Parameters

##### url

`string`

##### model?

`string`

#### Returns

`Promise`\<\{ `message`: `string`; `ok`: `boolean`; \}\>

***

### testLocalTts

> **testLocalTts**: (`url`, `model?`) => `Promise`\<`ArrayBuffer` \| `null`\>

Defined in: [shared/types.ts:161](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L161)

#### Parameters

##### url

`string`

##### model?

`string`

#### Returns

`Promise`\<`ArrayBuffer` \| `null`\>

***

### transcribeAudio

> **transcribeAudio**: (`buffer`) => `Promise`\<`string`\>

Defined in: [shared/types.ts:137](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/shared/types.ts#L137)

#### Parameters

##### buffer

`ArrayBuffer`

#### Returns

`Promise`\<`string`\>
