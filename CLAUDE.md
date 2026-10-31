# Animal Crossing Music — working notes

Chrome extension that plays the hourly Animal Crossing music, K.K. Slider songs and an hourly town tune.
This is George's fork of `animal-crossing-music-extension/ac-music-extension`; upstream has been inactive
since 2022. **The fork is public.**

Plain JavaScript, Manifest V3, no build step, no package manager, no test suite. To run it, use
Load unpacked on `chrome://extensions` and pick this folder.

## How the background works

- `offscreen.html` is a hidden page that runs the background scripts it lists (everything in
  `scripts/background/` except `service_worker.js`, plus `scripts/global/tune_player.js`): audio, loop
  points, town tune, hourly timer, weather, badge, notifications. Script order matters.
- Offscreen pages can only use `chrome.runtime`. `scripts/background/ChromeBridge.js` defines
  `chrome.storage`, `chrome.action`, `chrome.notifications` and `chrome.tabs` there by messaging
  `scripts/background/service_worker.js`, which makes the real calls and forwards events back.
  - A new `chrome.*` method or event in background code must be added to both files.
  - Bridge methods take callbacks only (no promises). On error they log and skip the callback.
  - The worker forwards `tabs.onUpdated` only when `audible` or `mutedInfo` changes.
- The offscreen page lists `AUDIO_PLAYBACK` and `BLOBS` as reasons. Keep `BLOBS`: with only
  `AUDIO_PLAYBACK`, Chrome closes the page after 30 seconds of silence.
- Image paths sent to the worker (toolbar icon, notification icon) must be full URLs (`getLocalUrl`);
  the worker can't load short paths.
- Settings live in `chrome.storage.sync`. Each file that reads a setting repeats its default
  (`StateManager.js`, `scripts/options/options.js`, and others), so search for the key before changing one.
  A new setting also needs a control in `options.html` and a line in `saveOptions`.

## Music

- Streamed from the original maintainers' server, `https://acmusicext.com/static/`:
  `{game}/{weather}/{hour}.ogg` (hour like `9am`), `kk/{live|aircheck}/{song}.ogg`, `kk/art/{song}.png`.
  Live weather: `https://acmusicext.com/api/weather-v1/{country}/{zip}`.
- George keeps a local copy in `music/` (same layout) and the K.K. art in `img/cover/kk/`. Both are
  gitignored. Never commit them: the repo is public and the music is Nintendo's.
- `.gitignore` ignores every `*.ogg` except `sound/bells.ogg`. A new bundled `.ogg` needs its own `!` line.

## Workflow

- Base branch is `develop`. Open PRs on the fork: `gh pr create --repo davisgcii/ac-music-extension --base develop`.
- Branded Chrome ignores `--load-extension`. For automated checks, use Chrome for Testing from the
  Playwright cache (`~/Library/Caches/ms-playwright/chromium-*/`) driven over the DevTools protocol.
- Never let a test play music out loud. Launch test browsers with `--mute-audio`, close them when the run
  ends (including on failure), and don't add audible tests to the repo.
- After a merge, `git pull` in `~/dev/ac-music-extension`, then reload the extension on `chrome://extensions`.
