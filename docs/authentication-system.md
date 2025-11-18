# Authentication System Documentation

**Project**: Scottish AI Lessons
**Last Updated**: 2025-11-18
**Status**: Production

## Overview

The Scottish AI Lessons application uses Appwrite for authentication with server-side session management via httpOnly cookies. This provides secure, SSR-compatible authentication for the Next.js frontend.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser       │     │   Next.js       │     │   Appwrite      │
│   (Client)      │────▶│   API Routes    │────▶│   Cloud         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │  httpOnly Cookie      │   Server SDK          │
         │  (session token)      │   (API Key)           │
         └───────────────────────┴───────────────────────┘
```

### Key Design Decisions

1. **Server-Side Sessions**: All authentication uses server-side session validation via `createSessionClient()` which reads httpOnly cookies
2. **No Client SDK**: Frontend components don't use Appwrite client SDK directly for security
3. **SSR Compatible**: Authentication works with Next.js SSR/RSC patterns
4. **Fast Fail**: All auth failures throw exceptions immediately with detailed error logging

## Authentication Flow

### 1. Login Flow

```typescript
// POST /api/auth/login
1. User submits email/password
2. Server calls Appwrite account.createEmailPasswordSession()
3. Session token stored in httpOnly cookie
4. Redirect to /dashboard
```

### 2. Session Validation

```typescript
// createSessionClient() pattern
import { createSessionClient } from '@/lib/server/appwrite';

export async function GET(request: Request) {
  try {
    // This throws if no valid session
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // User is authenticated
    return Response.json({ user });
  } catch (error) {
    // No session found - fast fail
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
}
```

### 3. Logout Flow

```typescript
// POST /api/auth/logout
1. Server calls account.deleteSession('current')
2. Clear httpOnly cookie
3. Redirect to /login
```

## Environment Configuration

### Required Variables

```bash
# .env.local
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key  # Server-side only, NOT public
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your-database-id
```

### Collection IDs

```typescript
// lib/server/appwrite.ts
export const appwriteConfig = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
  studentsCollectionId: 'students',
  coursesCollectionId: 'courses',
  subscriptionsCollectionId: 'subscriptions',
  // ... other collections
};
```

## Key Components

### Server Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `createSessionClient()` | `lib/server/appwrite.ts` | Creates authenticated client from session cookie |
| `createAdminClient()` | `lib/server/appwrite.ts` | Creates admin client with API key (for webhooks) |

### React Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useServerAuth()` | `hooks/useServerAuth.ts` | Check authentication state (SSR-safe) |
| `useLogout()` | `hooks/useLogout.ts` | Handle logout with redirect |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Create session |
| `/api/auth/logout` | POST | Destroy session |
| `/api/auth/session` | GET | Check session validity |
| `/api/student/me` | GET | Get current user's student record |

## User Roles and Permissions

### Admin Users

Admin users have the `admin` label in Appwrite:

```typescript
// Check admin status
const user = await account.get();
const isAdmin = (user.labels || []).includes('admin');
```

### Test Users

Test users have the `testUserFlag` set to `true` in the students collection:

```typescript
// Test user bypass logic
const hasAccess = user.testUserFlag === true ||
                  user.subscriptionStatus === 'active';
```

## Error Handling

### Common Error Codes

| HTTP Status | Appwrite Code | Meaning |
|-------------|---------------|---------|
| 401 | `user_session_not_found` | No active session |
| 401 | `user_invalid_token` | Session expired |
| 403 | `user_unauthorized` | Permission denied |
| 404 | `document_not_found` | User/student not found |

### Fast Fail Pattern

```typescript
// ALWAYS throw on auth failure - no fallbacks
try {
  const { account } = await createSessionClient();
  const user = await account.get();
} catch (error) {
  console.error('[API] Auth failed:', error);
  throw new Error('Authentication required');
}
```

## Security Considerations

### Cookie Security

- **httpOnly**: Prevents XSS attacks from reading session token
- **Secure**: Cookie only sent over HTTPS in production
- **SameSite**: Set to `Strict` to prevent CSRF

### API Key Protection

- `APPWRITE_API_KEY` is server-side only (no `NEXT_PUBLIC_` prefix)
- Never exposed to client-side code
- Used only for admin operations (webhooks, background jobs)

### CORS Configuration

- Appwrite project configured to allow requests from application domain
- No wildcard origins in production

## Testing Authentication

### Manual Testing

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Check session
curl http://localhost:3000/api/auth/session \
  -H "Cookie: your-session-cookie"

# 3. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: your-session-cookie"
```

### Test Credentials

For development/testing:
- **Email**: `test@scottishailessons.com`
- **Password**: `red12345`

### Playwright E2E Tests

```typescript
// e2e/tests/helpers/auth.ts
export async function authenticateUser(page, credentials) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', credentials.email);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}
```

## Troubleshooting

### Common Issues

#### "No session found"
- **Cause**: httpOnly cookie not being sent
- **Solution**: Ensure `credentials: 'include'` in fetch calls

#### "User not found"
- **Cause**: Account exists but no student document
- **Solution**: Create student document with `userId` linking to account

#### "Unauthorized" for admin routes
- **Cause**: User missing `admin` label
- **Solution**: Add label via Appwrite Console or API

### Debug Logging

Enable detailed auth logging:

```typescript
// In API route
console.log('[Auth Debug] Session check:', {
  hasSession: !!session,
  userId: user?.$id,
  labels: user?.labels
});
```

## Related Documentation

- [Payment System Documentation](./payment-system.md)
- [Appwrite Documentation](https://appwrite.io/docs)
- [Next.js Authentication Patterns](https://nextjs.org/docs/authentication)
