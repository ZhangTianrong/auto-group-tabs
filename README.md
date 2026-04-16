# Tab Group Automata

This repository is a fork of [loilo/auto-group-tabs](https://github.com/loilo/auto-group-tabs), originally created by Florian Reuschel.

It is a Chromium-based browser extension for automatic tab grouping with regex rules, domain-based grouping, and smart tab group expand/collapse behavior.

## Attribution

This fork includes and distributes code from the original project under the MIT license. The upstream copyright notice for Florian Reuschel is preserved in [LICENSE](./LICENSE), and the packaged extension now ships with attribution files in the build output.

## Development

This project is built with [Vue](https://v3.vuejs.org/) and [Vite](https://vitejs.dev/).

### Setup

Clone this fork:

```bash
git clone https://github.com/ZhangTianrong/auto-group-tabs.git
```

Step into the cloned folder and install [npm](https://www.npmjs.com/) dependencies:

```bash
npm ci
```

### Development of the Options UI

The fastest way to tinker with the heart of this extension — its options page — is to run the `dev` script:

```bash
npm run dev
```

This will start up the Vite dev server and serve the options page on [localhost:16655](http://localhost:16655/). Having the options page directly in the browser allows for comfort features like hot module reloading to be usable during development.

In this mode, Chrome extension APIs accessed during production (e.g. `chrome.i18n` and `chrome.storage`) use browser-based fallbacks.

> **Note:** You probably want to use the [device toolbar](https://developers.google.com/web/tools/chrome-devtools/device-mode) of Chrome's devtools to give the options page a proper viewport. Chrome's options overlays are (at the time of writing) 400px wide, and I used a height of 600px during development.

### Testing in Chromium

To test the extension in a Chromium-based browser, you'll have to do a production build of it:

```bash
npm run build
```

This will create a subfolder with the name `extension` inside the project, which can be installed in your browser as an unpacked extension.
