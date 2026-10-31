// Manifest V3 has no persistent background page, and a service worker can't
// play audio. So the background scripts run in a hidden offscreen document
// (offscreen.html), and this worker keeps that document open.
//
// Offscreen documents can only use chrome.runtime. This worker makes the other
// chrome.* calls for the document and forwards it the events it listens to.
// ChromeBridge.js is the document's side of this.

'use strict';

// The chrome.* calls the offscreen document can ask for.
const apiCalls = {
	'storage.sync.get': keys => chrome.storage.sync.get(keys),
	'storage.sync.set': items => chrome.storage.sync.set(items),
	'action.setBadgeText': details => chrome.action.setBadgeText(details),
	'action.setBadgeBackgroundColor': details => chrome.action.setBadgeBackgroundColor(details),
	'action.setIcon': details => chrome.action.setIcon(details),
	'notifications.create': (id, options) => chrome.notifications.create(id, options),
	'tabs.query': queryInfo => chrome.tabs.query(queryInfo)
};

let creatingOffscreenDocument = null;

// Creates the offscreen document if it doesn't exist. Calls made while a
// check is running wait for that check, so the document is created only once.
function ensureOffscreenDocument() {
	if (!creatingOffscreenDocument) {
		creatingOffscreenDocument = createOffscreenDocumentIfMissing().finally(() => {
			creatingOffscreenDocument = null;
		});
	}
	return creatingOffscreenDocument;
}

async function createOffscreenDocumentIfMissing() {
	let contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
	if (contexts.length > 0) return;

	await chrome.offscreen.createDocument({
		url: 'offscreen.html',
		// Chrome closes a document whose only reason is AUDIO_PLAYBACK after 30
		// seconds of silence. That would stop the town tune from playing on the
		// hour while paused, and stop music from resuming after another tab
		// stops playing audio. BLOBS (used for media session artwork) has no
		// time limit, so the document stays open.
		reasons: ['AUDIO_PLAYBACK', 'BLOBS'],
		justification: 'Plays the hourly music, K.K. Slider songs and the town tune.'
	});
}

function openOffscreenDocument() {
	ensureOffscreenDocument().catch(error => console.error('Could not create the offscreen document:', error));
}

function forwardEvent(name) {
	return (...args) => {
		ensureOffscreenDocument()
			.then(() => chrome.runtime.sendMessage({ target: 'offscreen', event: name, args }))
			.catch(error => console.error(`Could not forward ${name}:`, error));
	};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.target !== 'worker') return;

	Promise.resolve()
		.then(() => apiCalls[message.method](...message.args))
		.then(result => sendResponse({ result }), error => sendResponse({ error: error.message }));
	return true; // Keeps the message channel open for the async response.
});

chrome.storage.onChanged.addListener(forwardEvent('storage.onChanged'));
chrome.action.onClicked.addListener(forwardEvent('action.onClicked'));
chrome.tabs.onCreated.addListener(forwardEvent('tabs.onCreated'));
chrome.tabs.onRemoved.addListener(forwardEvent('tabs.onRemoved'));

// Tabs update all the time (loading, titles, icons). Only audio changes matter.
const forwardTabUpdated = forwardEvent('tabs.onUpdated');
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if ('audible' in changeInfo || 'mutedInfo' in changeInfo) forwardTabUpdated(tabId, changeInfo, tab);
});

// Listening to onStartup makes Chrome start this worker when the browser
// opens. The call below covers every other start (install, update, events).
chrome.runtime.onStartup.addListener(openOffscreenDocument);
openOffscreenDocument();
