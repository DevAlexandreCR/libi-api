# libi-back

Node.js + TypeScript backend for multi-tenant WhatsApp ordering with AI assistance. Built with Express, Prisma (MySQL), JWT auth, and Docker/devcontainer support.

## Features
- Multi-tenant domain: merchants, users, WhatsApp lines, menus, sessions, orders, uploads.
- JWT authentication for super admins and merchant admins.
- WhatsApp Cloud API webhook: routes customer messages to OpenAI order assistant, persists sessions/orders, and replies via WhatsApp.
- Meta Embedded Signup handled in the frontend; backend stores `access_token`, `phone_number_id`, `waba_id`, etc.
- Menu import from photos using OpenAI; maps extracted JSON into Prisma models.
- REST APIs for merchants, WhatsApp lines, menus, orders, sessions, and SSE stream for realtime order updates.
- Devcontainer + Docker Compose with MySQL; ESLint + Prettier; Vitest sample tests.

## Getting started
1. Copy `.env.example` to `.env` and adjust values (database URL, JWT secret, OpenAI key, Meta verify token).
2. Install dependencies and generate Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Apply migrations and seed sample data:
   ```bash
   npx prisma migrate dev --name init
   npx ts-node prisma/seed.ts
   ```
4. Run the API:
   ```bash
   npm run dev
   ```

### Docker / Devcontainer
- `docker-compose up --build` runs MySQL (`db`) and the API (`api`).
- `.devcontainer/devcontainer.json` is configured to open in VS Code using the compose stack.

## Key API endpoints (prefixed by `/api`)
- **Auth**: `POST /auth/login`
- **Merchants**: CRUD at `/merchants`
- **WhatsApp lines**: list/create under `/merchants/:merchantId/whatsapp-lines`; complete embedded signup at `/merchants/:merchantId/whatsapp-lines/embedded-signup/complete`; webhook at `/webhooks/whatsapp` (GET verify, POST messages)
- **Menus**: `GET /merchants/:merchantId/menus/current`; `PATCH /menu-items/:id/availability`
- **Menu import**: upload images `POST /merchants/:merchantId/menu-import/uploads`; process images `POST /merchants/:merchantId/menu-import/process`
- **Orders**: list `/merchants/:merchantId/orders`; detail `/orders/:orderId`; update status `/orders/:orderId/status`; SSE stream `/merchants/:merchantId/orders/stream`
- **Sessions**: list `/merchants/:merchantId/sessions`; detail `/sessions/:sessionId`

## Testing
```bash
npm test
```
(Vitest sample covers order creation mapping.)

## Notes
- OpenAI API key is required for WhatsApp bot replies and menu extraction.
- Meta verify token (`META_VERIFY_TOKEN`) must match the webhook configuration in Meta.
- Uploaded files are stored under `UPLOAD_DIR` (default `uploads/`) and persisted in the `Upload` table.
