# TeamForge

A realtime capstone team-formation workspace for **Saptagiri NPS University**. Students publish skill profiles, projects define the roles they need, and the match engine scores complementary candidates so teams can form, invite, and lock a balanced roster.

Built as a small, dependency-free Node application: vanilla ES modules on the client, `node:sqlite` for persistence, and Server-Sent Events for live sync.

## Quick start

Requires **Node.js 22.5+** (Node 24 recommended) for the built-in `node:sqlite` module.

```bash
npm start
```

Open <http://localhost:4173>. The database is created and seeded on first boot at `data/teamforge.db`. Set `TEAMFORGE_DB` to use a different file, and `PORT` to change the port.

`npm run dev` restarts the server on file changes.

### Preview mode

Opening `index.html` without the server (for example, straight from disk or a static preview host) loads `data/seed.json` read-only. Invitations, profile edits, project creation, and realtime updates require the server.

## What is in the demo

- 12 students with skill levels, availability, experience, and preferred roles
- 4 capstone projects in different stages (forming, complete, locked)
- Teams with filled and open slots, plus pending invitations
- A live activity feed and compatibility scores

Create a student account or sign in from the app. Seeded sample students remain available as matching profiles, but are not login accounts. Identity switching is available only in static preview mode.

## Features

- **Overview** — Team SOS risk radar, ranked next actions, a selected-project seat chart, readiness, and recent activity
- **Match studio** — ranked candidates per project role with transparent score breakdowns, filters, and one-click invitations
- **Team room** — roster gaps, role coverage, balance score, and roster locking
- **Student directory** — search by skill, role, year, and availability
- **Profiles** — edit skills, levels, availability, bio, and optional LinkedIn/GitHub links; changes broadcast instantly
- **Projects** — create and edit projects and their role requirements
- **Realtime** — SSE broadcast of invitations, acceptance notifications, joins, profile edits, and locks across tabs
- **Accounts** — self-registration, password sign-in, sign-out, and expiring server-side sessions
- **Preview mode** — static snapshot when the API is unavailable
- **Responsive, accessible UI** — keyboard-friendly dialogs, skip link, reduced-motion support, self-hosted fonts

## Matching

Scoring lives in `shared/match.js` and is shared by the server and the browser. A candidate is scored per role on:

- skill overlap with the project's required skills, weighted by proficiency
- role fit with the student's preferred role
- availability against the project's expected commitment
- team balance (skill coverage the roster is still missing)
- penalties for double-booking and for already-full teams

The UI exposes the component scores rather than a single opaque number.

## API

All API responses are JSON. Workspace routes require an authenticated HTTP-only session cookie.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/bootstrap` | Full snapshot + computed stats for the current identity |
| GET | `/api/session` | Current signed-in account, or `null` |
| GET | `/api/catalog` | Roles and skills used during registration |
| POST | `/api/register` | Create an account and start a session |
| POST | `/api/login` | Sign in and start a session |
| POST | `/api/logout` | Revoke the current session |
| GET | `/api/events` | SSE stream of workspace events |
| POST | `/api/projects` | Create a project |
| PATCH | `/api/projects/:id` | Update a project and its roles |
| POST | `/api/projects/:id/invitations` | Invite a student to a role |
| POST | `/api/invitations/:id/respond` | Accept or decline an invitation |
| PATCH | `/api/students/:id` | Update your profile |
| POST | `/api/teams/:id/lock` | Lock a complete roster |

## Project structure

```
index.html            App shell and navigation
assets/app.js         Client app: routing, views, forms, SSE
assets/styles.css     Design system and layouts
assets/mark.svg       Product mark / favicon
assets/fonts/         Self-hosted Fraunces + Public Sans
server.js             HTTP server, REST API, SSE
lib/db.js             SQLite store, seeding, mutations
schema.sql            Database schema
shared/match.js       Scoring engine shared by client and server
data/seed.json        Demo dataset
```

## Deployment

The app is a single Node process with no runtime dependencies.

### Docker

```bash
docker build -t teamforge .
docker run -p 4173:4173 -v teamforge-data:/app/storage teamforge
```

### Render

`render.yaml` is included. It provisions a Node web service with a persistent disk mounted at `/var/data`, and sets `TEAMFORGE_DB=/var/data/teamforge.db` so rosters survive restarts. SQLite requires a persistent disk; ephemeral filesystems will reseed on every deploy.

Any host that can run Node 22.5+ and persist a single file will work. There is no external database or build step.

## Notes and limitations

- Passwords are scrypt-hashed and session tokens are stored as hashes. Sessions expire after seven days.
- This installation has no email verification or password-reset delivery. Accounts should use email addresses their owners control; add verification and recovery before public production use.
- Seeded sample profiles have no passwords and cannot be used to sign in.
- There is no email delivery; invitations appear in-app only.
- The database is seeded with fictional students and projects.
- Realtime fan-out is in-process. Running multiple instances requires a shared event bus.
