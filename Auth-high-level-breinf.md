✅ IMPLEMENTED: Next.js + Appwrite Auth (Email/Password + Google) — MCP-Driven Brief
Goals

Ship email/password auth with a clean password reset journey.

Add Sign in with Google.

Make sessions work in SSR and client paths (Next.js App Router).

On first successful auth, sync user to your students collection (userId, name, role).

MCP lets Claude operate your Appwrite resources (Users, Databases, etc.) directly from your editor/agent — perfect for automating the data model & QA flows. 
appwrite.io
+1

What the AI coder (Claude) should do via Appwrite MCP
1) Data model: create students collection (owner-only)

Create collection students with owner-only read/write (user can access only their doc).

Attributes

userId (string, required, unique)

name (string)

role (enum: "student" | "teacher")

Indexes

Unique index on userId.

Ask Claude: “Using Appwrite MCP Databases, create students with attributes above, owner-only permissions, and a unique index on userId.”

2) Email/password signup & login (server actions + cookie)

Server-side (Next.js App Router):

account.create(email, password, name) → then account.createEmailPasswordSession(email, password).

Set HttpOnly + Secure + SameSite=strict cookie with session secret.

Post-auth sync: check if a students doc exists for this userId; if not, create it ({ userId, name, role: "student" }) via MCP.

For SSR, keep two Appwrite clients: admin (API key) and session (from cookie). Guard protected pages by calling account.get() server-side. 
appwrite.io
+1

3) Password reset (Recovery flow)

Expose routes:

POST /auth/recovery → account.createRecovery(email, redirectUrl)

POST /auth/recovery/confirm → account.updateRecovery(userId, secret, newPassword)

Build /reset-password page that reads userId & secret from query and posts the new password.

QA with MCP:

Verify user exists (users.get), and after reset, they can login with the new password.

Flow is first-party: recovery email links back to your redirect URL with userId + secret; you then confirm with updateRecovery. 
appwrite.io
+1

4) Google sign-in (OAuth2)

In your app:

Start OAuth: either client (account.createOAuth2Session("google", successURL, failureURL)) or server (create token → redirect → callback → account.createSession(userId, secret)), then set your auth cookie.

After OAuth success, ensure a students doc exists (create if missing) — do it in the callback handler via MCP.

Note for schools: Pupils using Google Workspace/“Classroom” accounts can sign in if the domain admin allows third-party OAuth access (often “Sign in with Google only” is permitted). Coordinate allowlisting if blocked. 
appwrite.io
+1
Google Help

5) Logout

Delete your session cookie.

Call account.deleteSession("current").

6) SSR guards & data fetching

On protected pages, create a session client (reads your cookie) and call account.get(); redirect if unauth.

Use the session client to read the user’s students document (owner permissions will pass). 
appwrite.io

Minimal integration notes (Next.js App Router)

Cookie name: pick one (e.g., appwrite-session).

Set after login, delete on logout; read in server components/route handlers to build a session-scoped client.

Session lifetime: rely on Appwrite’s session expiry; prompt re-login when account.get() fails. (JWTs are optional; normal sessions suffice.) 
appwrite.io

MCP QA checklist (for Claude to run)

Health

users.list and databases.listCollections (expect students).

Happy path (email)

users.create test user → login via app → verify users.listSessions and that a students doc exists (create if missing).

Recovery

Trigger createRecovery via app → complete updateRecovery → login → confirm with users.listSessions. 
appwrite.io

Google OAuth

Run OAuth flow → confirm session → ensure students doc is present (MCP create if missing). 
appwrite.io

Security guardrails

HttpOnly + Secure + SameSite=strict cookie for session token.

Use server SDK for SSR; do not expose API key to the browser. 
appwrite.io

Limit API key scopes; owner-only permissions on students.

School domains: if Google login fails, ask IT to allow third-party apps for Sign in with Google or allowlist your OAuth client ID. 
Google Help