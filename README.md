# CampusFindy

CampusFindy is a campus lost-and-found application with a static HTML/CSS/JavaScript frontend and an Express/MongoDB API.

## Requirements

- Node.js 20 or newer
- MongoDB, local or hosted
- SMTP credentials for account verification and password-reset email

## Local setup

1. Install the root dependencies:

   ```sh
   npm install
   ```

2. Copy `Frontend/server/.env.example` to `Frontend/server/.env` and set at least:

   - `MONGO_URI`
   - `JWT_SECRET` (use a randomly generated value of at least 32 characters)
   - `FRONTEND_URL` (the exact browser origin, such as `http://127.0.0.1:5500`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`

   Keep `.env` private; do not commit real credentials.

3. Start the API from the repository root:

   ```sh
   npm start
   ```

4. Serve the `Frontend` folder with a static file server. For example, with the VS Code Live Server extension, open `Frontend/index.html`. The default local API URL is `http://localhost:5000/api`.

## Configuration and deployment

The root `package.json` is the sole dependency manifest for the backend. Run install, start, development, and test commands from the repository root.

`Frontend/api-config.js` selects the local API URL on `localhost` and uses the same-origin `/api` path elsewhere. If the deployed frontend and API use different origins, set `window.CAMPUSFINDY_API_BASE` to the full API base URL before `api-config.js` loads, or update its deployment default. Configure the backend's `FRONTEND_URL` with the exact frontend origin; multiple allowed HTTPS origins can be comma-separated in production.

### Free Cloudflare Pages + Render setup

This project can use a free `*.pages.dev` frontend URL and a free `*.onrender.com` API URL. Free service limits can change; Render's free web service may sleep when idle, so the first request after inactivity can take longer.

1. Push this repository to GitHub.
2. In Cloudflare, create a **Pages** project from the repository. Set the root directory to `Frontend`, leave the build command empty, and set the build output directory to `.`. After deployment, copy the site's HTTPS origin (for example, `https://campusfindy.pages.dev`).
3. In Render, create a **Blueprint** from the same repository and use the root `render.yaml`. Set the prompted environment values in Render's dashboard; do not put credentials in the repository:
   - `MONGO_URI`: your MongoDB Atlas connection string. Use a MongoDB deployment that supports transactions for item claims.
   - `JWT_SECRET`: a randomly generated secret with at least 32 characters.
   - `FRONTEND_URL`: the exact Cloudflare Pages origin, without a trailing slash.
   - `PASSWORD_RESET_URL`: the full URL to the deployed page, e.g. `https://campusfindy.pages.dev/reset-password.html`.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: your email provider's SMTP settings. These are required for verification and password-reset emails.
4. Once Render deploys, copy its HTTPS service URL (for example, `https://campusfindy-api.onrender.com`). In `Frontend/api-config.js`, set the non-local `defaultApiBase` to that URL followed by `/api` (for example, `https://campusfindy-api.onrender.com/api`), then commit and push. Cloudflare Pages will redeploy the frontend.
5. Open `https://<your-render-service>.onrender.com/api/health`; a healthy deployment returns `"status":"ok"` when MongoDB is connected. Test signup, email verification, login, and password reset on the Pages site.

The Render blueprint sets `TRUST_PROXY_HOPS=1` for the Render proxy and uses `/api/health` as its readiness check. Configure MongoDB network access for the deployed API as required by your provider; never expose database credentials in frontend files or commit them to GitHub. The built-in rate limiter uses in-memory counters; multiple API instances need a shared rate-limit store to enforce limits consistently.

`GET /api/health` reports whether the API can reach MongoDB and is suitable for a deployment readiness check. Configure MongoDB backups and restore testing with your database provider; this service does not create database backups. Authentication email endpoints require SMTP configuration. Item claims are limited to one approved claim per item, enforced transactionally; MongoDB must support transactions (for example, a replica set or compatible managed cluster).

Claimants can track submitted requests from **My Posts & Requests**. Finder contact details are available there only after the finder approves the request.

## Tests

Run the backend tests from the repository root:

```sh
npm test
```

The claim-route tests use mocked model methods and do not require a running MongoDB instance. They verify route behavior but do not replace a staging test against the production MongoDB topology.
