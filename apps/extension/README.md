# 📖 Reading Assist — Browser Extension

A browser extension that helps you read foreign texts on **any website**. Select text and get instant dictionary-style translations with phonetic pronunciation guides.

Works on **Chrome** and **Firefox** (Manifest V3).

Part of the [Reading Assist monorepo](../../README.md).

## ✨ How It Works

1. Browse any website (news, blogs, social media)
2. **Select/highlight** text in a foreign language
3. A floating panel appears with dictionary-style translations including phonetic pronunciation (Pinyin for Chinese, IPA for others), multiple definitions, example sentences, and frequency labels.

## 🛠 Build

From the workspace root:

```bash
npm install              # Install all workspaces
npm run build:extension  # Production build
npm run dev:extension    # Watch mode — rebuilds on file changes
```

Or from this directory:

```bash
npm install
npm run build            # Production build
npm run dev              # Watch mode
```

Output is in `dist/`. For development, load `dist/` as an unpacked extension once, then click **Reload** in `chrome://extensions` after each rebuild.

## 🚀 Install (Development / Sideloading)

### Chrome / Edge
1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `dist/` folder

### Firefox
1. Build the Firefox variant: `npm run build:firefox` (from root) or `npm run build:firefox` (from this directory)
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `dist-firefox/manifest.json`

> **Why two builds?** Chrome requires `background.service_worker`, Firefox requires `background.scripts`. The build system auto-detects the target and generates the correct manifest.

## ⚙ Configuration

Click the extension icon in the toolbar to open settings:
- **API Key**: Your DeepSeek API key (stored in `chrome.storage.sync` — syncs across signed-in browsers)
- **Source Language**: The language you're reading
- **Target Language**: The language for translations

## 📷 OCR

The popup includes an OCR tab — upload an image and extract text with Tesseract.js (runs entirely in your browser).

## 🏗 Architecture

```
apps/extension/
├── manifest.json          # MV3 manifest (Chrome + Firefox)
├── vite.config.ts         # Multi-entry build + post-processing
├── src/
│   ├── content/           # Content script injected into every page
│   │   ├── content.tsx    # Entry: creates Shadow DOM + renders React
│   │   ├── ContentApp.tsx # Floating panel: selection detection + API calls
│   │   └── content.css    # Shadow DOM styles (isolated from host page)
│   ├── popup/             # Toolbar popup with settings & OCR
│   │   ├── popup.html
│   │   ├── popup.tsx      # React app: tabs for Settings & OCR
│   │   └── popup.css
│   ├── background/
│   │   └── service-worker.ts  # Install handler
│   └── services/
│       └── storage.ts     # chrome.storage.sync wrapper
├── public/icons/
└── dist/                  # Built extension (load this folder)
```

Shared code (types, translation service, OCR, languages) lives in `packages/shared/` and is imported as `@reading-assist/shared`.

## 🔑 API Key

This extension requires a [DeepSeek API key](https://platform.deepseek.com/api_keys). Your key never leaves your browser — it's stored in `chrome.storage.sync` and sent directly to `api.deepseek.com`.
