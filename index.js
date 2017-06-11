const EventEmitter = require('events')
const PQueue = require('p-queue')
const scanBox = require('imap-scan-box')

// It is a limitation of the IMAP protocol, or at least
// of the `imap` module, that fetching messages from
// multiple boxes at the same time is simply not possible.
// In any case, using the `imap` module means that the
// sequence number starts drifting and other similarly
// confusing issues arise when multiple scans are allowed
// to occur at the same time.
const concurrencyLimit = 1

const defaultRange = '1:*'
const defaultFetch = {
	bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
	struct: true
}

module.exports = ({ imap, boxes = [], range = defaultRange, fetch = defaultFetch }) => {
	const emitter = new EventEmitter()
	const queue = new PQueue({ concurrency: concurrencyLimit })

	setTimeout(() => {
		boxes.forEach(boxName => {
			queue.add(() => new Promise((resolve, reject) => {
				const scanner = scanBox(imap, boxName, range, fetch)

				scanner.once('end', resolve)

				scanner.once('error', ({ action, error }) => {
					emitter.emit('error', {
						action,
						error,
						box: boxName
					})
					resolve()
				})

				scanner.on('opened', box => emitter.emit('opened', box))
				scanner.on('closed', box => emitter.emit('closed', box))

				scanner.on('message', ({ sequenceNumber, stream }) => {
					emitter.emit('message', {
						sequenceNumber,
						box: boxName,
						stream
					})
				})
			}))
		})
	})

	queue
		.onEmpty()
		.then(() => emitter.emit('end'))
		.catch(error => {
			emitter.emit('error', { action: 'queue.onEmpty', error })
			emitter.emit('end')
		})

	return emitter
}
