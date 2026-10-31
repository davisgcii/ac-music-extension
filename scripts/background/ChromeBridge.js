// Offscreen documents can only use chrome.runtime. This file adds the other
// chrome.* APIs the background scripts use. Each call is sent to the service
// worker, which runs it and sends back the result. The service worker also
// forwards the events listened to here.
//
// Only the methods and events the background scripts use are included.
// To add one, add it below and to apiCalls in service_worker.js.

'use strict';

(function () {

	let eventListeners = {};

	// Returns a function that runs a chrome.* method in the service worker.
	// Like the real API, it takes an optional callback as the last argument.
	function workerMethod(method) {
		return function (...args) {
			let callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
			chrome.runtime.sendMessage({ target: 'worker', method, args })
				.then(response => {
					if (response.error) throw new Error(`chrome.${method} failed: ${response.error}`);
					if (callback) callback(response.result);
				})
				.catch(error => console.error(error));
		};
	}

	// Returns an event whose listeners are called when the service worker
	// forwards that event.
	function workerEvent(name) {
		let listeners = eventListeners[name] = new Set();
		return {
			addListener: listener => listeners.add(listener),
			removeListener: listener => listeners.delete(listener)
		};
	}

	chrome.runtime.onMessage.addListener(message => {
		if (message.target !== 'offscreen') return;
		for (let listener of eventListeners[message.event] || []) listener(...message.args);
	});

	chrome.storage = {
		sync: {
			get: workerMethod('storage.sync.get'),
			set: workerMethod('storage.sync.set')
		},
		onChanged: workerEvent('storage.onChanged')
	};

	chrome.action = {
		setBadgeText: workerMethod('action.setBadgeText'),
		setBadgeBackgroundColor: workerMethod('action.setBadgeBackgroundColor'),
		setIcon: workerMethod('action.setIcon'),
		onClicked: workerEvent('action.onClicked')
	};

	chrome.notifications = {
		create: workerMethod('notifications.create')
	};

	chrome.tabs = {
		query: workerMethod('tabs.query'),
		onCreated: workerEvent('tabs.onCreated'),
		onRemoved: workerEvent('tabs.onRemoved'),
		onUpdated: workerEvent('tabs.onUpdated')
	};

})();
