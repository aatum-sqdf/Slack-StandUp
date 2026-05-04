# Slack `/standup` → Notion

A small Express server that powers a `/standup` Slack slash command. Teammates can append agenda items to a Notion database whose rows represent days. Each item is attributed to the Slack username who ran the command. Designed for a daily standup at **7 PM PST**.

## How it works

```
Slack /standup ──HTTPS──► Express server (Railway)
                            │
                            ├── verify HMAC signature
                            ├── parse "[target] [item]"
                            ├── ack 200 ephemeral within ~50ms
                            └── async: Notion (find-or-create page, append bullet)
                                        │
                                        └── post final ephemeral via response_url
```

## Command syntax

```
/standup [target] <item>
```

Targets:

| Target | Meaning |
|---|---|
| (none) | `next standup` — today if before 7 PM PST, else tomorrow |
| `today` | today's PST date (always literal) |
| `tomorrow` | tomorrow's PST date |
| `next standup` | today if before 7 PM PST, else tomorrow |
| `monday`–`sunday` | soonest occurrence; today if it's that weekday and before 7 PM PST, else next week's |
| `YYYY-MM-DD` | that exact date |

Examples:

```
/standup Fix the login bug
/standup tomorrow Deploy v2
/standup next standup Demo prep
/standup friday Review with marketing
/standup 2026-05-15 Quarterly review
```

Each item is stored in Notion as a bullet: `@<slack_username>: <item text>`.

---

## Setup

### 1. Notion database

1. Create a full-page database in Notion called **Daily Standups**.
2. Add these properties:
   - `Title` (built-in title column — rename it to `Title` if Notion called it `Name`)
   - `Date` — Date type
   - `Status` — Status type (optional). Default options `Open` / `Done`.
3. Create an internal integration: <https://www.notion.so/my-integrations> → **New integration** → copy the secret. This is your `NOTION_TOKEN`.
4. In your **Daily Standups** database, click `…` → **Connections** → connect the integration so it has read/write access.
5. Copy the database ID from the URL. Example URL:
   ```
   https://www.notion.so/myworkspace/abcdef0123456789abcdef0123456789?v=...
                                     └────────── this 32-char hex ──────────┘
   ```
   This is your `NOTION_DATABASE_ID`.

### 2. Slack app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
   - App name: `Standup Bot`
   - Pick your workspace.
2. **Basic Information** → copy the **Signing Secret**. This is your `SLACK_SIGNING_SECRET`.
3. **OAuth & Permissions** → under **Bot Token Scopes**, add `commands`.
4. **Slash Commands** → **Create New Command**:
   - Command: `/standup`
   - Request URL: `https://<your-railway-domain>/slack/standup` (you'll fill this in after deploy or with ngrok)
   - Short description: `Add an item to a daily standup agenda`
   - Usage hint: `[today|tomorrow|next standup|monday-sunday|YYYY-MM-DD] <item>`
5. **Install to Workspace**.

### 3. Local development with ngrok

```powershell
npm install
copy .env.example .env
# fill in SLACK_SIGNING_SECRET, NOTION_TOKEN, NOTION_DATABASE_ID
node src/server.js
```

In another terminal:

```powershell
ngrok http 3000
```

Copy the `https://<random>.ngrok-free.app` URL. In Slack, set the slash command Request URL to `https://<random>.ngrok-free.app/slack/standup` and save.

Test in Slack:

```
/standup Test item
/standup tomorrow Deploy v2
/standup friday Review with marketing
/standup 2026-05-15 Quarterly review
```

You should see an ephemeral ack within 1 s and a final ephemeral with the Notion page URL within 3 s. Check your Notion database — rows are created per-date and bullets accumulate under each.

### 4. Deploy to Railway

1. `git init`, commit all files, push to a new GitHub repo.
2. Sign in to <https://railway.app> → **New Project** → **Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Node, runs `npm install` and `npm start`.
4. **Service → Variables**, add:
   - `SLACK_SIGNING_SECRET`
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`

   Don't set `PORT` — Railway injects it.
5. **Service → Settings → Networking → Generate Domain**. Copy the `*.up.railway.app` URL.
6. Back in Slack → **Slash Commands** → edit `/standup` → set Request URL to `https://<your-app>.up.railway.app/slack/standup`. Save.

## Environment variables

| Var | Where to get it |
|---|---|
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information |
| `NOTION_TOKEN` | <https://www.notion.so/my-integrations> |
| `NOTION_DATABASE_ID` | Notion database URL (32-char hex) |
| `PORT` | Auto-injected by Railway; `3000` locally |

## Project layout

```
src/
  server.js         Express entrypoint
  slackVerify.js    HMAC v0 signature verification
  dateParser.js     Parse target + item, PST timezone math
  notionClient.js   Find-or-create page, append bullet
  responder.js      POST final ephemeral to Slack response_url
package.json
.env.example
.gitignore
README.md
```

## Troubleshooting

- **`invalid signature` (401)** — `SLACK_SIGNING_SECRET` doesn't match the one in Slack's Basic Information, or the request body got mutated by a middleware. The route uses `express.raw` to preserve the byte buffer.
- **Notion `object_not_found`** — your integration isn't connected to the database. Re-open the database, click `…` → Connections → add the integration.
- **Notion `validation_error` mentioning Status** — handled automatically: the server retries page creation without a Status property. Either remove Status from the schema or make sure the option `Open` exists.
- **`Couldn't add to Notion: …`** — check Railway logs for the underlying Notion API error.
- **Slash command times out** — the server acks within ~50 ms; if you're seeing a timeout, the server probably failed to start. Check Railway logs for `standup server listening on PORT`.
