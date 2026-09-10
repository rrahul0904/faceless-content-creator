# Faceless Content Creator

Autonomous faceless-content operating system for discovering ideas, writing short-form scripts, generating presenter-led vertical video, reviewing content, publishing or scheduling it across connected social accounts, and learning from performance.

This project reverse-engineers the Orshot + n8n faceless-video tutorial and turns its four-node proof of concept into a production-oriented application.

## What works

- Interactive Next.js creation studio
- Niche + idea → hook, script and caption
- Provider-neutral OpenAI-compatible LLM integration with deterministic demo fallback
- Orshot AI presenter generation
- Orshot Studio vertical MP4 rendering
- Asynchronous render jobs with polling
- Render-completion webhook correlation
- Playable rendered-video review state in the browser
- Immediate, scheduled and held-draft social publishing API
- Cross-platform social analytics and posting insights API
- PostgreSQL persistence using Prisma
- Channels, content lifecycle and publication data model
- Importable n8n reference workflow upgraded with a real social-draft step
- Docker + local PostgreSQL configuration
- GitHub Actions typecheck and production build
- Standalone Next.js production output for Docker/Vercel hosting

## Product flow

```text
Idea / source
    ↓
Script + hook + caption
    ↓
AI presenter
    ↓
Vertical render + captions
    ↓
Review
    ↓
Draft / schedule / publish
    ↓
Views + engagement + follower data
    ↓
Performance insights for the next content cycle
```

## Quick start

```bash
git clone https://github.com/rrahul0904/faceless-content-creator.git
cd faceless-content-creator
npm install
cp .env.example .env.local
docker compose up -d postgres
npx prisma generate
npx prisma db push
npm run dev
```

Then open `http://localhost:3000`.

Script generation works without an external LLM in deterministic demo mode. Real presenter generation and rendering require an Orshot API key, Studio template ID, presenter image URL and voice ID.

## Required environment for real video generation

```bash
ORSHOT_API_KEY="..."
ORSHOT_TEMPLATE_ID="..."
ORSHOT_PRESENTER_IMAGE="https://..."
ORSHOT_VOICE_ID="..."
```

Set `APP_BASE_URL` to the public application URL and a strong `WEBHOOK_SECRET` to enable render-completion callbacks.

See [`docs/SETUP.md`](docs/SETUP.md) for setup and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the production architecture.

## n8n recreation

Import:

```text
workflows/n8n/faceless-content-creator.json
```

The reference workflow reproduces the original schedule → content → presenter → render flow, and adds a disabled-by-default Orshot social-draft node so publishing remains behind an explicit review gate until you decide to enable it.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /api/script` | Generate a short-form script package |
| `POST /api/presenter` | Generate the presenter video |
| `POST /api/render` | Start asynchronous final rendering |
| `GET /api/render/:id` | Poll a render through completion |
| `POST /api/publish` | Draft, schedule or publish a rendered video |
| `GET /api/analytics` | Read social analytics or computed insights |
| `GET/POST /api/channels` | Manage content channels |
| `GET/POST /api/content` | Manage the content queue |
| `POST /api/webhooks/orshot` | Reconcile completed async render jobs |
| `GET /api/health` | Service health check |

## Status

The application code, data model, automation workflow and deployment scaffolding are checked into GitHub and validated through CI. A real end-to-end social post still requires your own provider credentials, Orshot template/presenter configuration, connected social account IDs and a production database/application deployment. Those are runtime account configuration rather than hard-coded repository secrets.

## License

MIT
