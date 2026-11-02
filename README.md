# FoodResQ

FoodResQ is a neighborhood food-rescue workspace for food donors, receiving partners, delivery partners, and operations administrators. It includes a responsive React website, a separate restricted Admin Panel, an Express API, and MongoDB models for accounts, verification history, listings, delivery coordination, notifications, and incident reports.

The browser-only workspace is labeled **DEMO** and uses fictional records saved in local browser storage. Connected accounts use the API session cookie and MongoDB records.

## Problem statement and objectives

Food rescue depends on donors, receiving organizations, and delivery partners coordinating perishable food before collection windows expire. FoodResQ provides a shared workflow to publish surplus, claim available listings, coordinate and confirm handoffs, and record the food distributed. Admin verifies accounts and handles monitoring or exceptional intervention; routine listings and deliveries do not wait for Admin action.

## Key features and implementation status

| Feature | Status | Current implementation |
| --- | --- | --- |
| Public accounts and role-based access | Implemented | Donors, receiving partners, and delivery partners register through the API; protected operations check roles and ownership. |
| Account verification and resubmission | Implemented | New accounts are pending, admins approve or reject with a reason, and rejected applicants may update details and resubmit. |
| Separate Admin Panel | Implemented | Admin login, account verification, account suspension, listing monitoring and restriction, delivery monitoring and reasoned emergency assignment, and incident screens use admin-protected routes. |
| Direct food publication and claims | Implemented | Approved donors publish valid listings as available; approved receiving partners claim an entire listing directly. Claims use a conditional database update and create one delivery task. |
| Delivery task acceptance | Implemented | A task with no partner is offered to approved partners in the pickup locality. The first successful atomic acceptance starts the trip and notifies the donor and recipient. |
| Delivery and recipient confirmation | Implemented | Authorized participants advance existing trip statuses; pickup verification is retained; only the receiving partner records delivered quantity and confirms receipt. |
| Pickup verification and browser location | Partially implemented | Pickup code hashes and active-trip browser location updates are supported. Location depends on the assigned partner opening the page and granting browser permission; route maps and continuous background tracking are not configured. |
| Notifications | Partially implemented | Matching and workflow notices are stored in-app. Email, SMS, and other external notification providers are not configured. |
| Browser demo | Implemented | Fictional local data demonstrates public role workflows without creating API accounts or granting Admin Panel access. |
| Production deployment | Unavailable | No hosting target, deployment manifest, or production service has been configured or verified in this repository. |

## Technology stack

- **Frontend:** React 18, React Router, Vite, Axios, and Lucide icons.
- **Backend:** Node.js ES modules, Express 4, Mongoose 8, JWT sessions in HTTP-only cookies, and bcryptjs password hashing.
- **Database:** MongoDB. Mongoose models define accounts, donations, deliveries, distributions, incidents, and notifications.
- **Checks:** Node's built-in test runner and Vite production build.

## Supported roles and verification

| Role | Stored value | Access and verification |
| --- | --- | --- |
| Food Donor | `donor` | Publishes valid listings after account approval, follows claims and deliveries, and verifies pickup. |
| Receiving Partner | `recipient` | Sees available listings matched by pickup locality, claims a listing directly, confirms receipt, and records aggregate distribution. |
| Delivery Partner | `partner` | Sees unassigned delivery tasks matched by pickup locality, accepts a task directly, advances pickup and transit states, and can share location during an active trip. |
| Platform Admin | `admin` | Uses the separate `/admin/login` panel to review verification requests, manage suspension, monitor listings and deliveries, restrict a problematic available listing, and make reasoned emergency delivery assignments. Created only through the secure interactive bootstrap command; public registration cannot create admins. |

The public role names map to the stored values `donor`, `recipient`, and `partner`; historical delivery and distribution references continue to use the same user IDs. Admin is an internal role and is not offered in public registration or browser demo accounts.

Connected public accounts move from pending to approved or rejected. Rejected applicants can update their name, organization, and service area, then resubmit for review. Admin suspension changes the visible status to suspended; reinstatement restores the account's prior verification status. Donors can publish only after approval, recipients need approval to claim food or record distributions, and delivery partners need approval to accept or update tasks. Pending and rejected users can sign in to see their status and any rejection reason. Suspended accounts cannot sign in; each protected request reloads the account from MongoDB so a stale session cannot continue operational work after suspension.

## Requirements

- Node.js 20.19+ (Node 22 or 24 recommended)
- npm 10+
- MongoDB 6+ for persistent API mode

## Setup

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Set `MONGODB_URI` and replace `JWT_SECRET` in `server/.env`. `CLIENT_ORIGIN` must match the website origin. Keep both `.env` files private and out of Git.

If you previously used the root `.env`, it remains untouched and ignored by Git. The server prefers `server/.env` and falls back to the root `.env` for settings not already defined there, so existing local configuration continues to work. No secret values were copied into the examples.

## Start

```powershell
npm run dev
```

The website runs at `http://localhost:5173` and the API at `http://localhost:4000`. Vite proxies `/api` requests to the API by default.

You can run either app separately:

```powershell
npm run dev:client
npm run dev:server
```

Build the website and start the API with:

```powershell
npm run build
npm start
```

If MongoDB is not configured, the API still starts and reports the database as disconnected; database-backed routes will not operate. Use `/join` to explore the fictional browser demo.

## Troubleshooting

### Vite reports `ECONNREFUSED` for `/api/*`

The local Vite proxy forwards `/api` to `http://localhost:4000`. `ECONNREFUSED` means the API is not listening at that address. The API connects to MongoDB before it opens its listening port, so a request made during startup can be refused. Wait for `FoodResQ API listening on http://localhost:4000` in the server output, then refresh the page. To check the API directly, open `http://localhost:4000/api/health`; a running API returns HTTP 200 and reports whether MongoDB is connected. A `401` from `/api/auth/me` is expected when no signed-in session cookie is present and confirms that the request reached the API.

If the API listening message does not appear, run `npm run dev:server` in a terminal and check its output for MongoDB connection errors or a port conflict. If you set a custom server `PORT`, update the proxy target in `client/vite.config.js` to use that same port.

## Environment configuration

### Client (`client/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Public API base URL used by the browser. Defaults to `/api`. Do not put secrets here. |
| `Vite proxy` | Local development proxies `/api` to `http://localhost:4000`. |

### Server (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` or `production`; controls secure cookies and development safeguards. |
| `PORT` | API port. Defaults to `4000`. |
| `MONGODB_URI` | MongoDB connection string. |
| `JWT_SECRET` | Long, random signing secret for the HTTP-only session cookie. Required in production. |
| `CLIENT_ORIGIN` | Website origin allowed for credentialed CORS. |
| `COOKIE_SECURE` | Set to `true` when HTTPS is used. |
| `DEMO_MODE` | Set `true` only for local development to return a pickup code in the API response. Never enable in production. |

## Local demo

Open `/join` or choose **Log in > Explore the demo**. Available fictional roles are Food Donor (`donor`), Receiving Partner (`recipient`), and Delivery Partner (`partner`). Demo records remain in that browser's local storage. Admin access is unavailable in demo mode; demo records are not seeded MongoDB records and cannot authenticate against the API.

## Administrator bootstrap

After configuring MongoDB, run `npm run create-admin` in an interactive terminal. The script prompts for the administrator name, email, and a hidden password (14+ characters), hashes the password, and creates an approved admin account. Public registration cannot create admin users. Sign in at `http://localhost:5173/admin/login`; the account uses the existing rate-limited sign-in endpoint and HTTP-only session cookie. Do not provision an administrator by editing a public account or setting a role through a request.

## Checks

```powershell
npm run build
npm test
```

The backend tests cover role authorization, verification-status resolution, admin verification decisions and suspension restoration, donor listing gates and validation, recipient claim eligibility and concurrent claim conflicts, delivery acceptance conflicts, ownership checks, cross-origin mutation rejection, distribution rules, delivery transitions, and coordinate validation. These are controller/domain tests with mocked database operations; they do not replace database-backed API integration tests.

Verification status for this workflow:

- **Implemented and checked:** the 23 Node tests pass, including account gates, expired listing rejection, a competing-claim conflict, a competing-delivery-acceptance conflict, Admin emergency reassignment, and unauthorized delivery ownership. The Vite production build completes.
- **Implemented but not integration-tested here:** MongoDB persistence and indexes, in-app notification delivery, locality filtering against real account records, and deadline cleanup. The test suite uses mocked model calls and no live MongoDB-backed API run was performed.
- **Planned or incomplete:** external email/SMS delivery, background notification retries, map directions, continuous tracking, recipient delivery codes, and participant cancellation/rescheduling. The browser location feature is a one-time update while the delivery page is open.

## Project structure

```text
client/
  public/
  src/
    components/       Shared interface components
    layouts/          Authenticated workspace and Admin Panel shells
      AdminLayout.jsx
    constants/        Demo data, supported roles, and role navigation
    context/          Shared React context
    pages/            Public, authentication, workspace, and admin pages
      admin/          Separate admin login, dashboard, verification, and account pages
    routes/           Workspace and protected Admin Panel routes
      AdminRoutes.jsx
    services/         Axios client, API workspace loading, and admin API client
      adminService.js
    utils/            Browser storage and formatting helpers
    App.jsx
    main.jsx
  index.html
  vite.config.js
  package.json
  .env.example
server/
  src/
    config/           Environment and MongoDB setup
    middleware/       Authentication and error handling
    models/           Mongoose schemas and models
    routes/           Express API route groups
    services/         Shared backend operations
      deliveryTasks.js Deadline cleanup for unassigned delivery tasks
      matching.js     Approved locality matching for notices and task pools
      verification.js Verification status and legacy-account resolution
    utils/            Async route and response helpers
    app.js
    domain.js
    index.js
  scripts/            Administrator bootstrap
  tests/              Domain, verification, claim, and delivery concurrency tests
  package.json
  .env.example
```

## System architecture and workflows

The React client sends same-origin `/api` requests through Vite in development. Express applies security headers, credentialed CORS, JSON parsing, cookie parsing, and route-specific authentication/authorization middleware before calling controllers. Controllers validate workflow changes and persist them through Mongoose models in MongoDB; serializers omit credential fields from API account responses.

Account flow: public registration creates a pending account; an administrator records approval or rejection; rejected applicants may resubmit corrected account details. Suspension blocks protected sessions and records the prior status for reinstatement.

Connected food handoff flow: an approved donor publishes a validated listing directly as `available`; approved receiving partners in the pickup locality receive in-app notices and can claim the listing. A claim atomically moves the listing to `reserved` and creates its one delivery record in `assigned` with no delivery partner. Approved delivery partners in that pickup locality can accept the task; an atomic update assigns the first partner and moves the trip to `to_pickup`. The donor verifies pickup, the delivery partner records collection and transit, and the receiving partner records the quantity received to reach `delivered`. That final status represents recipient confirmation. Distribution records remain separate. If no locality match exists, the listing or task stays available for later matching or exceptional Admin intervention. The browser demo uses separate fictional records and local simulation.

Status mapping for the connected workflow:

| Workflow stage | Stored status and rule |
| --- | --- |
| Published and claimable | Donation `available`; automatically changes to `expired` after its deadline when listings or the Admin dashboard are read. |
| Claimed by a Receiving Partner | Donation `reserved`; the claim reserves the whole listing because one delivery record is supported per donation. |
| Awaiting a Delivery Partner | Delivery `assigned` with `partner: null`; eligible partners see it in the available task pool. |
| Accepted and pickup in progress | Delivery `to_pickup`; the accepting partner is recorded atomically. |
| Pickup handoff | Delivery `at_pickup`; partner requests a code, donor verifies it, then donor advances to `collected`. |
| Transit and arrival | Delivery `in_transit`, then `at_destination`, updated by the assigned partner. |
| Recipient-confirmed delivery | Delivery and donation `delivered`; only the associated Receiving Partner can record the received quantity and this transition. |
| Distribution recorded | Donation may become `distributed` after the recipient records all delivered portions; distribution entries remain separate records. |
| Exceptional or unavailable | Existing `cancelled`, `rejected`, and `expired` values remain available. An unassigned task is cancelled and its reserved listing expires after the collection deadline when deliveries or the Admin dashboard are read. Admin listing restriction changes an available donation to `rejected` and stores reviewer, time, and reason. |

## Database configuration and setup

Set `MONGODB_URI` in `server/.env` (or the supported root `.env` fallback). The API attempts the database connection before listening when a URI is configured; if that connection fails, startup exits and Vite reports a proxy connection error until the API is running. If no URI is configured, the API can listen, but database-backed routes cannot operate. `npm run create-admin` also requires a reachable configured database. No automatic verification migration runs; legacy status resolution and manual review guidance are documented below.

## API endpoint reference

All endpoints use the `/api` prefix. Routes not listed as public below require a supported signed-in account; the server also checks role, ownership, and workflow state where required.

| Endpoint | Access |
| --- | --- |
| `GET /health`, `GET /impact` | Public health status and aggregate impact counts. |
| `POST /auth/register` | Public; accepts only `donor`, `recipient`, or `partner`. New accounts start pending. |
| `POST /auth/login`, `POST /auth/logout` | Public login is rate limited; successful login sets an HTTP-only session cookie, and logout clears it. Unsupported legacy roles cannot log in. |
| `GET /auth/me` | Supported signed-in account session. |
| `PATCH /auth/resubmission` | Signed-in rejected public account; updates name, organization, and locality, then returns the application to pending and records the resubmission. |
| `GET /donations?page=&limit=`, `GET /requests`, `GET /deliveries` | Signed-in accounts; returned records are scoped by role and ownership. Donation results return total/page metadata; page size is capped at 100. |
| `POST /donations` | Approved Donor; validates handling, donor confirmation, preparation time, pickup details, and a future deadline, then publishes as `available`. Notifies approved recipients with an exact case-insensitive pickup-locality match. |
| `POST /donations/:id/claim` | Approved Receiving Partner; atomically claims the whole listing and creates one unassigned delivery task. A competing claim gets HTTP 409. |
| `POST /donations/:id/requests` | Deprecated; returns HTTP 410 and directs new workflows to direct claims. |
| `POST /donations/:id/requests/:requestId/respond` | Donor or Admin compatibility action for pending requests created by the older workflow; new claims need no donor decision. |
| `GET /distributions` | Receiving Partner or admin. |
| `POST /distributions` | Approved Receiving Partner with a completed delivery. |
| `POST /deliveries/:id/accept` | Approved Delivery Partner; atomically accepts an unassigned `assigned` task and advances it to `to_pickup`. A competing acceptance gets HTTP 409. |
| `POST /deliveries/:id/assign` | Admin emergency override only; assigns an unassigned task or reassigns a task before pickup. Requires an approved partner and a reason, and records the override in assignment history. |
| `POST /deliveries/:id/status` | Approved delivery participants; existing transitions are role-, ownership-, and state-checked and appended to status history. The Receiving Partner confirms receipt and quantity. |
| `POST /deliveries/:id/location`, `POST /deliveries/:id/pickup-code` | Approved assigned Delivery Partner; active-trip and rate limits apply. |
| `POST /deliveries/:id/verify-pickup` | Approved donor on that delivery; a valid, unexpired code may be used once. |
| `GET /admin/dashboard` | Admin only; database counts for verified and pending accounts, available listings, claimed donations, pending tasks, recipient-confirmed deliveries, all listing statuses, and recent verification activity. |
| `GET /admin/verification-requests?role=&status=` | Admin only; filter public accounts by role and status. Status accepts `pending`, `approved`, `rejected`, `suspended`, or `all`. |
| `GET /admin/verification-requests/:id` | Admin only; applicant details, current reviewer and decision time, reason, and retained verification history. |
| `PATCH /admin/verification-requests/:id/approve`, `PATCH /admin/verification-requests/:id/reject` | Admin only; decisions apply only to pending requests. Rejection requires a reason. Concurrent or repeated decisions return a conflict. |
| `GET /admin/users`, `PATCH /admin/users/:id/suspend`, `PATCH /admin/users/:id/reinstate` | Admin only; list public accounts and record suspension or reinstatement. Suspension requires a reason. The legacy `PATCH /admin/users/:id` accepts only a suspension action and reason; verification changes through it are rejected. |
| `GET /donations` (Admin session) | Admin only in the Admin Panel; monitors all listing states without a routine approval queue. |
| `PATCH /admin/donations/:id/review` | Admin only; retains legacy `approve`/`reject` handling for old `needs_review` records and allows a reasoned `restrict` action on an available listing. |
| `GET /admin/incidents`, `PATCH /admin/incidents/:id` | Admin only; incident review operations. |
| `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `POST /incidents` | Signed-in supported account; notification data is scoped to the account. |

## API and current boundaries

- Public account registration accepts only `donor`, `recipient`, and `partner`; it cannot grant admin access. The Mongoose user schema supports those roles plus `admin`, which is provisioned only through the interactive `create-admin` command. Admin uses its own `/admin/login` page and protected navigation. The removed Community Lead role is not accepted by registration, login, sessions, permissions, or dashboards.
- Passwords are bcrypt-hashed, sessions are signed and held in HTTP-only cookies, login is rate limited, and API routes check account role and record ownership. Admin APIs require a current Admin session on every request; state-changing browser requests also check the configured client origin and cross-site fetch metadata.
- New public accounts start as `pending`. Admin approval sets `approved`; rejection requires a reason shown to the applicant; applicants may update their name, organization, and service area and resubmit. Admin suspension sets `suspended` and records the prior status so reinstatement can restore it. Each important status change is appended to a per-account history capped at the most recent 100 entries.
- Donor publication, receiving-partner claims and distribution records, delivery-partner task acceptance and status updates require an approved account. The server reads the current account on each protected request and enforces role, ownership, status, deadline, quantity, and locality rules.
- The Admin Panel dashboard reads its counts and recent verification activity from MongoDB. Admins can review verification requests, suspend or reinstate accounts, monitor all listings and deliveries, restrict an available listing with a recorded reason, and make a reasoned emergency delivery assignment. The current signup flow does not upload supporting documents; account review uses the submitted name, organization, email, role, and service area only.
- The verification queue returns at most the 300 most recently submitted public accounts. The general admin user endpoint also caps its public-account results at 300. These lists do not yet paginate. Dashboard status and total counts are database aggregates.
- Donation fields are validated on the server. New connected listings become available immediately after an approved donor publishes them; they are not certified by FoodResQ. Receiving partner claims use a conditional database update and reserve the whole listing, matching the unique one-delivery-per-donation model. Old pending requests remain supported for records created before direct claims.
- Listing and delivery matching uses exact case-insensitive locality names only. No coordinates, distance radius, capacity matching, or route optimization is inferred. If locality is missing on either side, an approved partner may see the general available pool; notification targeting requires a locality match.
- Delivery task acceptance and emergency Admin assignment use atomic updates so only one partner can acquire an unassigned task. Admin can also reassign before pickup with a required reason. Delivery status and assignment history are retained on the delivery record. Partners can send rate-limited coordinates only for their assigned active trip. Location sharing depends on the tracking page remaining open and browser permission; the connected UI reports old updates as potentially stale.
- `Donation` records now retain `claimedBy` and `claimedAt`; `Delivery` records retain status and assignment histories. No destructive migration is required, no user data is rewritten, and no dependencies or environment variables were added.
- There is no background notification retry service. The first locality match receives an in-app notice; an unassigned task remains in the pool and is visible when an eligible Delivery Partner opens or refreshes the delivery page. Admin can make an audited emergency assignment.
- The schema supports `cancelled`, but participant-facing cancellation and rescheduling actions are not implemented. Report an issue for follow-up; cancellation policy and recovery flows remain incomplete.
- In development only, a pickup code may be returned directly by the API to support local integration work. A real SMS/email delivery provider is not included. Do not use this development path for live food handoffs.
- Account verification, bounded verification history, legacy listing review, reasoned listing restrictions, incident review, persistent in-app notifications, recipient distribution records, delivery transition history, and aggregate impact endpoints exist. Supporting-document upload, requests for additional information, real-time Socket.IO updates, external messaging, route directions, continuous/background GPS, event-organizer one-time access, CSV export filters, image storage, and a complete production audit/retention policy still require implementation or configuration before deployment.
- The local demo uses fictional listings and sample delivery state, all labeled as demo. It does not generate fake live GPS. Sharing location uses browser GPS after user permission.
- Safety fields communicate handling context. They are not a safety certification; use current official local food-safety guidance before deployment.

No production administrator or default password is created. Use the interactive bootstrap command only after securing access to the configured database.

## Legacy role data and manual review

No verification migration runs automatically, and this implementation does not rewrite existing account documents. For records without `verificationStatus`, reads derive the status from existing fields: `suspended: true` resolves to `suspended`, `verified: true` resolves to `approved`, and all other accounts resolve to `pending`. Existing unverified records are not approved. The former boolean-only workflow cannot distinguish old rejected applications from pending accounts, so an administrator must review those accounts individually; no rejection reason is inferred. Admin status filters and dashboard counts use this same fallback until an account receives a new recorded decision.

A read-only count of the currently configured database found one existing user document with the legacy stored role `community`; other database environments must be checked separately. That account cannot log in or use protected APIs, and it is excluded from the supported account-management list. Historical donation, delivery, and distribution documents remain untouched.

Before any manual resolution, take a database backup and review the account privately with its owner. A restricted MongoDB shell can locate legacy records with:

```javascript
db.users.find({ role: 'community' }, { _id: 1, name: 1, email: 1, verified: 1, suspended: 1 })
```

Do not batch-convert or delete these accounts. If an owner explicitly confirms a supported role and an administrator approves the change, update only that user's role after review; preserve its verification and suspension values unless the normal review process changes them. If no supported role is confirmed, leave the account blocked and retain its historical records. Role changes never automatically approve an account.

## Security considerations

Passwords are stored as bcrypt hashes. API sessions use signed HTTP-only cookies with `SameSite=Lax`, and protected routes enforce server-side role, approval, and record ownership checks. Claim and delivery assignment races are resolved with conditional database updates. Login and pickup-code routes are rate limited; pickup codes are hashed, expire, and can be verified once. Admin endpoints require the Admin role and state-changing cookie-backed requests validate the configured client origin. Admin accounts are created interactively and are never available through public registration. Keep environment files private, use a strong production `JWT_SECRET`, configure the exact client origin, and use HTTPS with secure cookies in production. The browser demo uses fictional local data and does not grant API privileges.

## Deployment status

This repository contains local development and production-build commands but no deployment target or deployment configuration. Deployment status is unverified. Before a production launch, configure MongoDB access, secrets, HTTPS and the allowed client origin; configure an external delivery channel if pickup codes must be sent securely. The README's local setup is not a deployment procedure.

## Frontend API configuration

The Vite client reads `VITE_API_URL` and appends the `/api` prefix when it is not included. `client/.env` points to the deployed API, while `client/.env.development` keeps local development pointed at `http://localhost:4000`; both environment files are ignored by Git. Copy `client/.env.example` when configuring another environment.

After deploying the frontend, set the backend's `CLIENT_ORIGIN` environment variable to the exact frontend origin, including `https://` and without a path or trailing slash. Express uses this value for credentialed CORS, and state-changing cookie requests must match it. The API session is an HTTP-only cookie; production sets `Secure` and `SameSite=Lax`. If the frontend is deployed on a different site from the API, update `sameSite` in both the session set and clear options in `server/src/middleware/auth.js` to `none`, and keep `Secure` enabled.

## Contribution guidelines

Keep the existing JavaScript React/Vite client and JavaScript Express/Mongoose server architecture. Update this README in the same change whenever documented behavior, roles, permissions, setup, routes, or project status changes. Before submitting code changes, run `npm test` and `npm run build` when possible, and never commit real environment secrets.

