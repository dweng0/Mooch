---
editUrl: false
next: false
prev: false
title: "TTSProviderManager"
---

Defined in: [main/services/tts-provider.ts:22](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/tts-provider.ts#L22)

Manages text-to-speech synthesis across multiple TTS providers.

## Constructors

### Constructor

> **new TTSProviderManager**(): `TTSProviderManager`

#### Returns

`TTSProviderManager`

## Methods

### getConfig()

> **getConfig**(): [`TTSConfig`](/Mooch/api/main/services/tts-provider/interfaces/ttsconfig/) \| `null`

Defined in: [main/services/tts-provider.ts:42](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/tts-provider.ts#L42)

Returns the current TTS provider configuration.

#### Returns

[`TTSConfig`](/Mooch/api/main/services/tts-provider/interfaces/ttsconfig/) \| `null`

The active TTS config, or null if not configured.

***

### setConfig()

> **setConfig**(`config`): `void`

Defined in: [main/services/tts-provider.ts:30](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/tts-provider.ts#L30)

Sets the active TTS provider configuration.

#### Parameters

##### config

[`TTSConfig`](/Mooch/api/main/services/tts-provider/interfaces/ttsconfig/)

The TTS configuration to use.

#### Returns

`void`

***

### synthesize()

> **synthesize**(`text`): `Promise`\<[`TTSResponse`](/Mooch/api/main/services/tts-provider/interfaces/ttsresponse/)\>

Defined in: [main/services/tts-provider.ts:51](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/tts-provider.ts#L51)

Synthesizes text to speech using the configured provider.

#### Parameters

##### text

`string`

The text to convert to speech.

#### Returns

`Promise`\<[`TTSResponse`](/Mooch/api/main/services/tts-provider/interfaces/ttsresponse/)\>

The synthesized audio response.

***

### testConnection()

> **testConnection**(): `Promise`\<`boolean`\>

Defined in: [main/services/tts-provider.ts:332](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/tts-provider.ts#L332)

Tests the TTS provider connection by synthesizing a short test phrase.

#### Returns

`Promise`\<`boolean`\>

True if the provider is reachable and working, false otherwise.
