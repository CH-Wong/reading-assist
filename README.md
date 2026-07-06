# 📖 Reading Assist

**A pair of applications for reading foreign texts** — a stand-alone web app and a browser extension. Both provide dictionary-style translations and OCR-based image text extraction. Designed initially for Mandarin Chinese but extensible to any language.

> **Default source language:** Mandarin Chinese (Simplified)  
> **Supported languages:** Mandarin Chinese, Cantonese, Dutch, German, English  
> **Translation engine:** DeepSeek Chat (LLM-based via OpenAI-compatible API)

---

## 🏗️ Monorepo Structure

This project uses **npm workspaces** with a shared code package:

```
reading-assist/
├── package.json                    # Workspace root — scripts to build everything
├── packages/
│   └── shared/                     # Shared types, translations, OCR, languages
│       └── src/
│           ├── types.ts
│           ├── languages.ts
│           ├── translation.ts
│           └── ocr.ts
├── apps/
│   ├── webapp/                     # Stand-alone React SPA (Vite)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   └── vite.config.ts
│   └── extension/                  # Chrome + Firefox browser extension
│       ├── src/
│       │   ├── content/            # Content script (Shadow DOM overlay)
│       │   ├── popup/              # Toolbar popup (settings + OCR)
│       │   └── background/         # Service worker
│       ├── manifest.json
│       └── vite.config.ts
└── cdk/                            # AWS CDK deployment (webapp only)
```

All shared logic lives once in `packages/shared/` — both apps import from `@reading-assist/shared`.

## ✨ Features

Both the **web app** and **browser extension** share the same core capabilities:

### Dictionary-Style Translations

When you select/highlight a word or phrase, a panel shows:
- **Simple translation** of the selected text
- **Phonetic pronunciation** — Pinyin with tone marks for Chinese, IPA for others
- **Multiple definitions** with part-of-speech labels (verb, noun, adjective, etc.)
- **Example sentences** showing common usage, each with a translation
- **Usage frequency labels** (common / rare / formal / informal)
- **Synonyms & antonyms** where applicable

### Web App — Text Editor

- A `contentEditable` area to paste or type foreign texts with basic formatting
- Live translation panel updates on text selection with ~400ms debounce
- Language selectors for source (with auto-detect) and target

### Browser Extension — Any Website

- **Select text on any webpage** — news, social media, blogs — and a floating panel appears
- **Shadow DOM** isolates styles from the host page
- **Popup** for settings (API key, languages) and OCR image upload
- Works on **Chrome** and **Firefox** (Manifest V3)

### OCR — Image Text Extraction

- Uses **Tesseract.js** — all processing happens in the browser; no image data sent to any server
- Supports auto-detect across multiple languages simultaneously
- Extracted text can be copied for use anywhere

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18 + TypeScript | Component-based UI, strong typing |
| **Build Tool** | Vite 6 | Fast HMR, modern ESM-based bundling |
| **Translation** | DeepSeek Chat API | LLM prompt delivers structured dictionary results |
| **OCR** | Tesseract.js 5 | Fully client-side; supports 100+ languages |
| **Styling** | Plain CSS | Zero dependencies; small bundles |
| **Monorepo** | npm workspaces | Shared code in `packages/shared/`, apps in `apps/` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm**
- **A DeepSeek API key** ([platform.deepseek.com](https://platform.deepseek.com/api-keys))

### Install & Build

```bash
# Install all workspaces (shared + both apps)
npm install

# Build both apps
npm run build
```

### Development

```bash
# Web app dev server (localhost:5173, with HMR)
npm run dev:webapp

# Extension dev mode (watches files, rebuilds on change)
# Load apps/extension/dist/ as unpacked extension once,
# then click "Reload" in chrome://extensions after each rebuild.
npm run dev:extension
```

### Individual Commands

| Command | Description |
|---------|-------------|
| `npm run build:webapp` | Build SPA → `apps/webapp/dist/` |
| `npm run build:extension` | Build extension → `apps/extension/dist/` |
| `npm run build` | Build both |
| `npm run dev:webapp` | Web app dev server at localhost:5173 |

### Extension Installation

#### Chrome / Edge
1. Build: `npm run build:extension`
2. Go to `chrome://extensions` → **Developer mode** → **Load unpacked** → `apps/extension/dist/`

#### Firefox — Temporary (development)
1. Build: `npm run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `apps/extension/dist-firefox/manifest.json`
3. Removed when Firefox restarts.

#### Firefox — Permanent
**Option A: Developer Edition** (no Mozilla account needed)
1. Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/)
2. Go to `about:config` → set `xpinstall.signatures.required` to `false`
3. Package: `cd apps/extension/dist-firefox && zip -r ../reading-assist.xpi *`
4. Drag `reading-assist.xpi` into Firefox or go to `about:addons` → gear → **Install Add-on From File**

**Option B: AMO Unlisted** (works on regular Firefox, free)
1. Build: `npm run build:firefox`, then zip `dist-firefox/` into `reading-assist.xpi`
2. Sign up at [addons.mozilla.org](https://addons.mozilla.org), go to **Submit a New Add-on** → **On your own** (unlisted)
3. Upload the `.xpi` — Mozilla auto-signs it within minutes
4. Download the signed `.xpi` and open it in Firefox for a permanent install

### Configuration

- **API Key**: The web app prompts on first use (stored in `localStorage`). The extension stores it in `chrome.storage.sync` (synced across devices via your browser account).
- **Languages**: Use the Source/Target dropdowns. Source supports auto-detect.
- **OCR Language**: Separate language selector with auto-detect option.

---

## ☁️ AWS Deployment (Infrastructure as Code)

This project includes **AWS CDK** infrastructure definitions for deploying to AWS via a single command — no clicking around the AWS console required.

### Architecture

```
                         CloudFront Distribution
         ┌───────────────────────────────────────────┐
         │                                           │
         │  /api/deepseek/*  ─────► api.deepseek.com │
         │  (CloudFront Function rewrites URI path)  │
         │                                           │
         │  /*  ───────────────────► S3 Bucket       │
         │                           (static files)  │
         └───────────────────────────────────────────┘
                            │
                    (Optional) Custom Domain
                      Route 53 → ACM SSL
```

| Component | Purpose |
|-----------|---------|
| **S3 Bucket** | Hosts the built static frontend files (HTML, JS, CSS) |
| **CloudFront** | Global CDN; serves static files + proxies API calls to DeepSeek |
| **CloudFront Function** | Rewrites `/api/deepseek/v1/...` → `/v1/...` for the DeepSeek origin |
| **S3 Bucket Deployment** | Automatically syncs `dist/` to S3 on deploy and invalidates CloudFront cache |
| **Route 53** (optional) | Custom domain DNS with A/AAAA alias records pointing to CloudFront |
| **ACM** (optional) | SSL/TLS certificate for the custom domain |

### How the API Proxy Works

In development, Vite's dev server proxies `/api/deepseek` → `api.deepseek.com`. In production, CloudFront does the same:

1. Browser calls `https://<domain>/api/deepseek/v1/chat/completions`
2. CloudFront matches the `/api/deepseek/*` behavior pattern
3. A **CloudFront Function** rewrites the URI: `/api/deepseek/v1/chat/completions` → `/v1/chat/completions`
4. The request is forwarded to `api.deepseek.com` with the original `Authorization` header (your API key)
5. The API key never touches your infrastructure — it stays client-side in the browser

### Prerequisites

- **Node.js** 18+ and npm
- **An AWS account** with an **Access Key ID** and **Secret Access Key** (create one in the [IAM console](https://console.aws.amazon.com/iam/home#/users))
- **DeepSeek API key** (existing feature — stored in browser localStorage)

### Authentication via `.env` (recommended)

The deploy scripts load credentials from a `.env` file, which is **ignored by git** so secrets stay local. A tracked `.env.example` serves as the template.

```bash
# One-time setup: create your .env from the template
cp .env.example .env

# Then edit .env with your AWS access keys
# (any text editor — Notepad, VS Code, etc.)
```

The `.env` file looks like this:

```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Optional: custom domain
# DOMAIN=reading.example.com
# HOSTED_ZONE_ID=Z1234567890
```

> **How it works:** The deploy script reads `.env` and exports each variable as a real environment variable. CDK (and the underlying AWS SDK) automatically picks up `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from the environment — no extra configuration needed.

Alternatively, you can use the AWS CLI's `aws configure` or pass `-Profile "name"` to the deploy script.

### Quick Deploy (no custom domain)

```bash
# PowerShell (Windows) — loads .env automatically
.\deploy.ps1

# Bash (macOS / Linux) — loads .env automatically
./deploy.sh
```

That's it. After a few minutes, CloudFront outputs a URL like `d123.cloudfront.net` — open it and use the app.

### Deploy with Custom Domain

```bash
# Prerequisite: a Route 53 hosted zone for your domain (e.g. "example.com")
# Option A: via .env (set DOMAIN and HOSTED_ZONE_ID)
.\deploy.ps1

# Option B: via CLI flag (overrides .env)
.\deploy.ps1 -Domain "reading.example.com" -HostedZoneId "Z1234567890"
```

This automatically:
1. Creates an ACM SSL certificate in `us-east-1` (required for CloudFront)
2. Validates the certificate via DNS (Route 53)
3. Adds the domain to CloudFront
4. Creates A/AAAA alias records in Route 53 pointing to CloudFront

### Manual CDK Commands

```bash
cd cdk
npm install

# Preview the CloudFormation template
npx cdk synth

# Deploy (with optional custom domain)
npx cdk deploy -c domain=reading.example.com -c hostedZoneId=Z1234567890

# Destroy all resources
npx cdk destroy
```

### Cost Estimate

| Service | Cost |
|---------|------|
| S3 | ~$0.10/month (negligible for this use case) |
| CloudFront | ~$0.10/month + data transfer (typically <$1/month) |
| CloudFront Function | Free tier (2M requests/month) |
| Route 53 | $0.50/month per hosted zone |
| ACM Certificate | Free |
| **Total** | **~$1/month** for low usage with custom domain |

---

## 🔒 Privacy & Security

| Concern | How It's Handled |
|---------|-----------------|
| **API Key** | Web app: `localStorage`. Extension: `chrome.storage.sync`. Never logged or sent to third parties. |
| **Translated Text** | Sent to DeepSeek's API. Subject to [DeepSeek's data usage policy](https://platform.deepseek.com/terms). |
| **Uploaded Images** | Processed entirely client-side via Tesseract.js. **Never** sent to any server. |
| **No Backend** | Pure client-side. No server component — deploy as static files. |
| **JSON Parse Errors** | Automatic retry with stricter prompt if the LLM returns malformed JSON. |

---

## 🔮 Future Enhancements

- **Offline translation** via local LLMs (Ollama) or pre-downloaded dictionaries
- **Anki/Spaced Repetition export** — save looked-up words to flashcard decks
- **Text-to-speech** — hear pronunciation via browser SpeechSynthesis API
- **Dark mode** — theme toggle
- **PDF import** — extract text from uploaded PDFs
- **Additional languages** — extend `LANGUAGE_OPTIONS` in `packages/shared/src/languages.ts`

---

## 📄 License

Open source. See [LICENSE](LICENSE).
