---
editUrl: false
next: false
prev: false
title: "getAnswer"
---

> **getAnswer**(`question`, `provider`, `context`): `Promise`\<`string`\>

Defined in: [main/services/ai-provider.ts:30](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/ai-provider.ts#L30)

Routes a question to the specified AI provider and returns the generated answer.

## Parameters

### question

`string`

The interview question to answer.

### provider

[`AIProvider`](/Mooch/api/shared/types/type-aliases/aiprovider/)

The AI provider to use for generating the answer.

### context

[`UserContext`](/Mooch/api/shared/types/interfaces/usercontext/)

User context including CV, job description, and manual context.

## Returns

`Promise`\<`string`\>

The generated answer text.
