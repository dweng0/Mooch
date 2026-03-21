---
editUrl: false
next: false
prev: false
title: "LocalBridgeApi"
---

Defined in: [main/services/local-bridge-api.ts:38](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L38)

Local HTTP API server that bridges the browser extension with the Electron app's AI providers.

## Constructors

### Constructor

> **new LocalBridgeApi**(): `LocalBridgeApi`

#### Returns

`LocalBridgeApi`

## Methods

### getExtensionState()

> **getExtensionState**(): [`ExtensionState`](/Mooch/api/main/services/local-bridge-api/interfaces/extensionstate/)

Defined in: [main/services/local-bridge-api.ts:58](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L58)

Returns a copy of the current browser extension connection state.

#### Returns

[`ExtensionState`](/Mooch/api/main/services/local-bridge-api/interfaces/extensionstate/)

The current extension state.

***

### getHintHistory()

> **getHintHistory**(): [`BridgeHintEntry`](/Mooch/api/main/services/local-bridge-api/interfaces/bridgehintentry/)[]

Defined in: [main/services/local-bridge-api.ts:66](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L66)

Returns a copy of the hint history log.

#### Returns

[`BridgeHintEntry`](/Mooch/api/main/services/local-bridge-api/interfaces/bridgehintentry/)[]

An array of previously generated hint entries.

***

### setActiveSession()

> **setActiveSession**(`sessionId`): `void`

Defined in: [main/services/local-bridge-api.ts:50](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L50)

Sets the active interview session ID for contextual hint generation.

#### Parameters

##### sessionId

`string` \| `null`

The session ID, or null to clear.

#### Returns

`void`

***

### setOnExtensionUpdate()

> **setOnExtensionUpdate**(`cb`): `void`

Defined in: [main/services/local-bridge-api.ts:74](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L74)

Registers a callback to be invoked when the extension state changes.

#### Parameters

##### cb

(`state`) => `void`

The callback function receiving the updated extension state.

#### Returns

`void`

***

### setOnHintGenerated()

> **setOnHintGenerated**(`cb`): `void`

Defined in: [main/services/local-bridge-api.ts:82](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L82)

Registers a callback to be invoked when a new hint is generated.

#### Parameters

##### cb

(`entry`) => `void`

The callback function receiving the generated hint entry.

#### Returns

`void`

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [main/services/local-bridge-api.ts:89](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L89)

Starts the local HTTP server on localhost:62544.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [main/services/local-bridge-api.ts:108](https://github.com/dweng0/Mooch/blob/bc25a30fe64af766d8602bff63c95681a91610d8/src/main/services/local-bridge-api.ts#L108)

Stops the local HTTP server.

#### Returns

`Promise`\<`void`\>
