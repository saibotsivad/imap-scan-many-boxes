# imap-scan-box

[![Greenkeeper badge](https://badges.greenkeeper.io/saibotsivad/imap-scan-many-boxes.svg)](https://greenkeeper.io/)

This module takes an instance of the
[imap](https://github.com/mscdex/node-imap) module, and
an array of box names (also known as "folders"), and returns
an emitter which emits for each message in each box, and
an `end` event when all box scans are complete.

## general use

```js
const Imap = require('imap')
const scanBoxes = require('imap-scan-many-boxes')

const imap = new Imap({
	user: 'me@gmail.com',
	password: 'abc123',
	host: 'imap.gmail.com',
	port: 993,
	tls: true
})

const boxes = [
	'INBOX',
	'INBOX.neat-folder'
]
const range = '1:10' // earliest 10 messages
const fetch = { // data to include in message bodies
	bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)'
}

// must wait until imap is ready
imap.once('ready', () => {
	const scanner = scanBoxes({ imap, boxes, range, fetch })
	// emitted messages emit the streaming object
	scanner.on('message', ({ stream, box }) => {
		console.log(box) // => 'INBOX' or 'INBOX.neat-folder'

		let body = ''

		message.on('body', (stream, info) => {
			stream.on('data', chunk => body += chunk.toString('utf8'))
		})

		message.once('attributes', attributes => {
			console.log(attributes)
		})

		message.once('end', () => {
			console.log(body)
		})
	})
})
```

### `scanBoxes(Object)`

The module takes an object with the following properties:

#### `imap`

The instance of `imap` provided must be instantiated and
have already emitted the `ready` event.

> Note: The IMAP protocol (or at least the `imap` module) does not
> support scanning multiple boxes simultaneously. 😭

#### `boxes` *(array of strings)*

An array of box names, e.g. `[ 'INBOX', 'INBOX.my-folder' ]`.

#### `range` *(string, default `1:*`)*

The range string for which messages to return.

#### `fetch` *(object, optional)*

The `fetch` object expected by the imap module.

Default value is:

```js
options.fetch = {
	bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
	struct: true
}
```

## emitted events

The returned emitter will emit the following events:

### `error` *(object)*

Each error object emitted has the following properties:

* `action` *(string)* The action which caused the error.
* `error` *(object|string)* The thrown error for that action.

The following error actions exist:

* `open`: Opening the IMAP box threw an error.
* `fetch`: Opened the box, but fetching the messages threw an error.
* `error`: Closing the IMAP box after fetching completed threw an error.

### `opened` *(opened)*

Emitted after each IMAP box is opened. The emitted object
is the `box` object given by the imap module.

### `message` *(object)*

Each message found during the `fetch` will be emitted with the
following properties:

* `sequenceNumber` *(integer)*: The sequence number of that fetch.
* `stream` *(stream)*: The message data, as a stream object.
* `box` *(string)*: The name of the box the message is from.

The stream object is the actual streamed message object
as given by the imap module.

### `end`

Emitted after all actions have completed. Either by way
of all box scans completing, or an error occuring which
prevents further scanning.

## license

Published and released under the [VOL](http://veryopenlicense.com).
