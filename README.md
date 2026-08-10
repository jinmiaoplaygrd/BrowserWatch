# BrowserWatch

BrowserWatch is an unpacked Microsoft Edge extension plus a local Node.js
companion. When monitoring is enabled, article-like pages and direct public
documents are summarized with your configured AI endpoint and appended to local
Markdown and JSONL memory files.

BrowserWatch does **not** read or reuse GitHub Copilot credentials from VS Code.
It can either use an OpenAI-compatible endpoint or ask the authenticated GitHub
Copilot CLI through Agent Client Protocol (ACP) in Agency mode.

## Requirements

- Microsoft Edge
- Node.js 20 or newer
- Either an authenticated GitHub Copilot CLI with ACP support, or an
  OpenAI-compatible chat-completions endpoint, API key, and model

## Install and run with Agency Copilot ACP

Sign in once if needed:

```bash
copilot
/login
```

Then start BrowserWatch:

```bash
npm install
export BROWSERWATCH_TOKEN="$(openssl rand -hex 24)"
export BROWSERWATCH_AI_PROVIDER="agency-acp"
node companion/server.js
```

BrowserWatch starts `copilot --acp --stdio` with Agency mode enabled. It
disables model tools, custom instructions, built-in MCP servers, and remote
session export; disables automatic CLI updates; rejects every permission
request; and strips all `BROWSERWATCH_*` variables from the child environment.
Disabling updates prevents BrowserWatch sessions from contacting GitHub release
download/CDN infrastructure. Update Copilot CLI separately when desired.
BrowserWatch also discovers and disables user and installed-plugin MCP servers,
so unrelated workplace integrations are not launched for article summaries.

Agency `2026.6.24.9` currently injects a conflicting `--session-id` when running
`agency copilot --acp`, so BrowserWatch invokes the authenticated `copilot`
binary directly with Agency mode enabled. Set `BROWSERWATCH_ACP_COMMAND` if the
binary has a different path. ACP support is a GitHub Copilot public preview.

## Install and run with an API endpoint

```bash
npm install
export BROWSERWATCH_TOKEN="$(openssl rand -hex 24)"
export BROWSERWATCH_AI_PROVIDER="openai"
export BROWSERWATCH_AI_ENDPOINT="https://api.openai.com/v1/chat/completions"
export BROWSERWATCH_AI_API_KEY="your-api-key"
export BROWSERWATCH_AI_MODEL="your-model"
node companion/server.js
```

Azure OpenAI users should set the full deployment chat-completions URL, set
`BROWSERWATCH_AI_AUTH_HEADER=api-key`, and set
`BROWSERWATCH_AI_AUTH_SCHEME` to an empty string.

Optional variables:

| Variable | Default |
| --- | --- |
| `BROWSERWATCH_PORT` | `43110` |
| `BROWSERWATCH_MEMORY_DIR` | `./browserwatch-memory` |
| `BROWSERWATCH_AI_PROVIDER` | `openai` |
| `BROWSERWATCH_AI_AUTH_HEADER` | `authorization` |
| `BROWSERWATCH_AI_AUTH_SCHEME` | `Bearer` |
| `BROWSERWATCH_ACP_COMMAND` | `copilot` |
| `BROWSERWATCH_AGENCY_MODEL` | Copilot CLI default |
| `BROWSERWATCH_AGENCY_TIMEOUT_MS` | `120000` |
| `BROWSERWATCH_DISABLED_MCPS` | Extra comma-separated MCP names to disable |

Open `edge://extensions`, enable **Developer mode**, choose **Load unpacked**,
and select this project directory. Open the BrowserWatch popup, paste the same
token used for the companion, save, and enable monitoring.

The companion writes:

- `browserwatch-memory/memory.md` for reading
- `browserwatch-memory/memory.jsonl` for structured processing

## Privacy and limits

- Monitoring starts disabled.
- While monitoring is enabled, BrowserWatch can locally block
  `cdn.jsdelivr.net` subresources before they reach Microsoft CASB. This option
  is enabled by default and can be turned off in the popup; it may disable
  optional controls on sites such as arXiv.
- Only qualifying HTTP(S) articles and public PDF, DOCX, or text documents are
  processed.
- Password, authentication, checkout, payment, banking, health portal, webmail,
  private network, and publisher-opted-out pages are excluded.
- The companion listens only on `127.0.0.1` and requires a shared token.
- HTML text is sent from the extension only to the configured loopback
  companion. The companion sends bounded text to the selected API service or
  authenticated Copilot ACP session.
- Direct documents must be publicly downloadable and are limited to 10 MB.
- URLs containing credential-like or signed-token query parameters are rejected
  to prevent secrets from entering memory or AI requests.
- The extension does not capture Edge InPrivate windows unless the user
  explicitly allows the extension there; it still suppresses incognito tab
  events.

In ACP mode, expected external hosts are the enterprise GitHub Copilot API and
Microsoft sign-in endpoints used by the installed CLI. BrowserWatch has no
runtime JavaScript, CSS, font, PDF, DOCX, or ACP dependency loaded from a CDN.
Direct document capture necessarily contacts the document's own host, which may
itself be a publisher CDN.

## Development

```bash
npm test
npm run check
```
