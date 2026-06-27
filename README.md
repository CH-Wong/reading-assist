# 📖 Reading Assist

**A web application for reading foreign texts** — providing dictionary-style translations, phonetic pronunciation guides, and OCR-based image text extraction. Designed initially for Simplified Chinese but fully extensible to any language.

> **Default source language:** Mandarin Chinese (Simplified)  
> **Supported languages:** Mandarin Chinese, Cantonese, Dutch, English  
> **Translation engine:** DeepSeek Chat (LLM-based via OpenAI-compatible API)

---

## ✨ Key Features

### 1. Main View — Text Editor + Live Reading Help

| Component | Description |
|-----------|-------------|
| **Rich Text Editor** | A `contentEditable` area where users paste or type foreign language texts. Supports basic formatting (bold, italic, underline, headings, lists). |
| **Live Translation Panel** | When the user selects/highlights any word or phrase, the panel shows a **dictionary-style result** that updates in real-time (~400ms debounce). |
| **Dictionary Results** | Each result includes: |
| | • **Simple translation** of the selected text |
| | • **Phonetic pronunciation** — Pinyin with tone marks for Chinese, IPA/romanization for other languages |
| | • **Multiple definitions** with part-of-speech labels (verb, noun, adjective, etc.) |
| | • **Example sentences** showing the word in common usage, each with a target-language translation |
| | • **Usage frequency labels** (common / rare / formal / informal) |
| | • **Synonyms & antonyms** where applicable |
| **Language Selectors** | Dropdown menus for Source and Target language. Source supports auto-detect mode for OCR. |

### 2. Image Scanning — OCR Text Extraction

| Component | Description |
|-----------|-------------|
| **Upload Button** | Located in the Text Editor section header. Click to upload an image. |
| **Client-side OCR** | Uses **Tesseract.js** — all processing happens in the browser; no image data is sent to any server. |
| **Language Selection** | Separate language selector for OCR, with an **auto-detect** option that tries multiple languages simultaneously. |
| **Text Appending** | Extracted text is appended to the text editor (with a visual separator), ready for reading and selection lookups. |

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18 + TypeScript | Component-based UI, strong typing, excellent ecosystem |
| **Build Tool** | Vite 6 | Fast HMR, modern ESM-based bundling |
| **Translation** | DeepSeek Chat API (OpenAI-compatible) | LLM prompt delivers structured dictionary results with no external dictionary API needed |
| **OCR** | Tesseract.js 5 | Fully client-side; supports 100+ languages; no server costs |
| **Styling** | Plain CSS (no framework) | Zero dependencies; keeps the bundle small and fully customizable |

### Project Structure

```
reading-assist/
├── index.html                    # Entry HTML
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite configuration
├── README.md                     # This file
├── public/
│   └── favicon.svg               # App icon
└── src/
    ├── main.tsx                  # React entry point
    ├── App.tsx                   # Root component — state management & layout
    ├── vite-env.d.ts             # Vite type declarations
    ├── types/
    │   └── index.ts              # All TypeScript interfaces & types
    ├── utils/
    │   └── languages.ts          # Language definitions, OCR mappings, helpers
    ├── services/
    │   ├── translation.ts        # DeepSeek API client for dictionary results
    │   └── ocr.ts                # Tesseract.js client for image text extraction
    ├── components/
    │   ├── LanguageSelector.tsx   # Reusable language dropdown
    │   ├── TextEditor.tsx         # Rich text editor with selection tracking
    │   ├── TranslationPanel.tsx   # Dictionary-style results display
    │   └── ImageUpload.tsx        # Image upload → OCR workflow
    └── styles/
        └── App.css               # All application styles
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│  ┌──────────────────────┐          ┌──────────────────────┐     │
│  │ Paste/Type text      │          │ Upload Image         │     │
│  └──────────┬───────────┘          └──────────┬───────────┘     │
│             │                                 │                 │
│             ▼                                 ▼                 │
│  ┌──────────────────────┐          ┌──────────────────────┐     │
│  │ TextEditor           │          │ ImageUpload          │     │
│  │ (contentEditable)    │          │  → Tesseract.js OCR  │     │
│  └──────────┬───────────┘          └──────────┬───────────┘     │
│             │                                 │                 │
│             │    ┌─────────────────────────────┘                 │
│             │    │  Extracted text appended                     │
│             ▼    ▼                                               │
│  ┌──────────────────────────────────────────┐                  │
│  │           Selection Detection             │                  │
│  │  (window.getSelection, selectionchange)   │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     │                                           │
│                     ▼ (debounced 400ms)                         │
│  ┌──────────────────────────────────────────┐                  │
│  │         Translation Service              │                  │
│  │  → DeepSeek Chat API (OpenAI-compatible)              │                  │
│  │  → Structured LLM prompt (deepseek-chat)                 │                  │
│  │  → Returns JSON with definitions,        │                  │
│  │    pinyin, examples, frequency           │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     │                                           │
│                     ▼                                           │
│  ┌──────────────────────────────────────────┐                  │
│  │         TranslationPanel                  │                  │
│  │  → Renders dictionary entry cards        │                  │
│  │  → Shows phonetic, POS, definitions,     │                  │
│  │    examples, frequency labels            │                  │
│  └──────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
<App>                              ← State hub: languages, editor content, selection, translation
  ├── <Header>
  │   ├── <LanguageSelector>       ← Source language (zh-CN, zh-HK, nl, en)
  │   └── <LanguageSelector>       ← Target language (en, nl, zh-CN, zh-HK)
  ├── <main>
  │   ├── <TextEditor>             ← Left pane: contentEditable + formatting toolbar
  │   │   └── <ImageUpload>        ← OCR button in section header
  │   └── <TranslationPanel>       ← Right pane: live dictionary results
  └── (API Key management via prompt/localStorage)
```

### Key Design Decisions

#### Why an LLM instead of a dictionary API?
Traditional dictionary APIs (like Youdao, Pleco, or Wiktionary) are language-specific and often require separate API keys for each language pair. An LLM-based approach:
- **Works across ALL language pairs** with a single integration
- Provides **rich structured data** (multiple definitions, examples, frequency) through careful prompt engineering
- Can **auto-detect languages** and handle edge cases gracefully
- Can be swapped for any OpenAI-compatible endpoint (local LLMs, Azure OpenAI, etc.)
- The structured JSON prompt produces results comparable to dedicated dictionary services

#### Why Tesseract.js over a cloud OCR service?
- **Privacy**: Images never leave the user's browser
- **No API costs**: Unlimited OCR usage
- **Offline-capable**: Works without internet after initial worker download
- **100+ languages**: Supports all four target languages

#### Why `contentEditable` instead of a textarea?
- Enables **basic text formatting** (bold, italic, etc.) that the user requested
- Allows **rich text insertion** (OCR results with separators)
- Supports **selection tracking** via the DOM Selection API for live translation lookups

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm** (or yarn/pnpm)
- **A DeepSeek API key** (get one at [platform.deepseek.com](https://platform.deepseek.com/api-keys))

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app opens at `http://localhost:5173`.

### Configuration

1. **API Key**: On first use, the app prompts for your DeepSeek API key. It is stored in `localStorage` and never sent anywhere except DeepSeek. Click the **🔑 API Key** button in the header to change it.
2. **Languages**: Use the Source/Target dropdowns to configure translation direction.
3. **OCR Language**: The image upload has its own language selector with an auto-detect option.

### Production Build

```bash
npm run build    # Outputs to dist/
npm run preview  # Preview the production build locally
```

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
| **API Key** | Stored in `localStorage`. Never logged or sent to third parties. |
| **Translated Text** | Sent to DeepSeek's API for processing. Subject to [DeepSeek's data usage policy](https://platform.deepseek.com/terms). |
| **Uploaded Images** | Processed entirely client-side via Tesseract.js. **Never** sent to any server. |
| **No Backend** | Pure client-side application. No server component — deploy as static files. |

---

## 🔮 Future Enhancements

- **Offline translation** via local LLMs (llama.cpp, Ollama) or pre-downloaded dictionary databases
- **Anki/Spaced Repetition export** — save looked-up words to flashcard decks
- **Reading progress tracking** — highlight and save passages
- **Text-to-speech** — hear pronunciation via browser's SpeechSynthesis API or external TTS
- **Dark mode** — theme toggle
- **PDF import** — extract text from uploaded PDF documents
- **Additional languages** — extend `LANGUAGE_OPTIONS` and `OCR_LANGUAGE_MAP` in `src/utils/languages.ts`

---

## 📄 License

This project is open source. See the [LICENSE](../LICENSE) file for details.
