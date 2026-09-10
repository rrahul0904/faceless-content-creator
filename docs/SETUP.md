# Setup

## 1. Local prerequisites

- Node.js 22
- Docker / Docker Compose
- An Orshot account and API key for real renders
- An Orshot Studio template with dynamic parameters matching your design

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values you use.

Required for persistence:

- `DATABASE_URL`

Required for real rendering/publishing:

- `ORSHOT_API_KEY`
- `ORSHOT_TEMPLATE_ID`

Optional AI script generation uses any OpenAI-compatible chat-completions endpoint:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

Without those LLM variables the product stays usable in deterministic demo mode.

## 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

## 4. Install and initialize

```bash
npm install
cp .env.example .env.local
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

## 5. Configure the Orshot template

The default adapter sends these dynamic parameters:

- `clip`
- `topic`
- `hook`
- `script`
- `stat_number`
- `stat_label`
- `handle`

You can change those parameter names in `lib/orshot.ts` to match your template.

For the tutorial-compatible AI presenter flow, import `workflows/n8n/faceless-content-creator.json` into n8n and configure an HTTP Header Auth credential that sends:

`Authorization: Bearer <ORSHOT_API_KEY>`

Replace the sample presenter image, template ID and social account IDs before running it.

## 6. Safety before publishing

The n8n social publish node ships **disabled** and uses `status: draft`. Review the generated MP4s and platform behavior before enabling unattended publishing.
