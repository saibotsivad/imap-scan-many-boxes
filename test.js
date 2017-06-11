const test = require('tape')
const proxyquire = require('proxyquire')
const delay = require('delay')
const EventEmitter = require('events')

test('when there is an error opening the box', t => {
	t.plan(9)
	const scannerEmitter = new EventEmitter()
	const error = { message: 'specific error' }
	const imap = 'mock imap object is not touched'
	const boxes = [ 'INBOX' ]

	const scanBoxes = proxyquire('./index', {
		'imap-scan-box': (imapPassedAlong, boxName, range, fetch) => {
			t.equal(imapPassedAlong, imap, 'the imap object passed in is not used')
			t.equal(boxName, 'INBOX', 'provided box name')
			t.equal(range, '1:*', 'no provided range uses default')
			t.equal(fetch.bodies, 'HEADER.FIELDS (FROM TO SUBJECT DATE)', 'using default fetch')
			t.ok(fetch.struct, 'using default fetch')
			return scannerEmitter
		}
	})

	const scanner = scanBoxes({ imap, boxes })

	scanner.on('error', output => {
		t.ok(output.error === error, 'the error is the same by reference')
		t.equal(output.action, 'open', 'the error happens during opening')
		t.equal(output.box, 'INBOX', 'the box name is included')
	})

	scanner.on('end', () => {
		t.pass('the scanner must end')
		t.end()
	})

	delay(10)
		.then(() => scannerEmitter.emit('error', {
			action: 'open',
			error
		}))
})

test('for multiple boxes one failure does not prevent another from being scanned', t => {
	t.plan(8)
	const firstScannerEmitter = new EventEmitter()
	const secondScannerEmitter = new EventEmitter()
	const firstBox = 'INBOX.Sent'
	const secondBox = 'INBOX.Archive'
	const boxes = [ firstBox, secondBox ]
	const error = { message: 'specific error' }
	const imap = 'mock imap object is not touched'

	let timesScanBoxWasCalled = 0
	const scanBoxes = proxyquire('./index', {
		'imap-scan-box': (imap, boxName, range, fetch) => {
			timesScanBoxWasCalled++
			if (boxName === firstBox) {
				return firstScannerEmitter
			} else if (boxName === secondBox) {
				return secondScannerEmitter
			} else {
				t.fail('an invalid box was called')
			}
		}
	})

	const scanner = scanBoxes({ imap, boxes })

	scanner.on('error', output => {
		t.equal(output.box, firstBox, 'the box name is included')
	})

	scanner.on('opened', thing => t.equal(thing, 'a', 'box object passed through'))

	scanner.on('message', output => {
		t.equal(output.box, secondBox, 'the box name is included')
		t.equal(output.stream, 'actually a stream', 'the stream is passed directly')
		t.equal(output.sequenceNumber, 100, 'the sequence number is passed directly')
	})

	scanner.on('closed', thing => t.equal(thing, 'b', 'box object passed through'))

	scanner.on('end', () => {
		t.pass('the scanner must end')
		t.equal(timesScanBoxWasCalled, 2, 'only two provided boxes scanned')
		t.end()
	})

	delay(10)
		.then(() => firstScannerEmitter.emit('error', {
			action: 'open',
			error
		}))
		.then(delay(10))
		.then(() => secondScannerEmitter.emit('opened', 'a'))
		.then(delay(10))
		.then(() => secondScannerEmitter.emit('message', {
			sequenceNumber: 100,
			stream: 'actually a stream'
		}))
		.then(delay(10))
		.then(() => secondScannerEmitter.emit('closed', 'b'))
		.then(delay(10))
		.then(() => secondScannerEmitter.emit('end'))
})
