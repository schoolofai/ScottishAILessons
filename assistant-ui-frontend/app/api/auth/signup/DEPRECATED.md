# DEPRECATED: Server-Side Signup Endpoint

**Status**: Replaced by client-side signup (2025-01-05)

## Reason for Deprecation

This endpoint created sessions in httpOnly cookies, but the dashboard expects sessions in localStorage. This caused a session mismatch bug where users would see "No active session found" after signup.

## Replacement

- **New Pattern**: Client-side signup in `components/auth/SignupForm.tsx`
- **New Endpoint**: `/api/auth/sync-student` for student record synchronization

## Bug Fixed

**Before** (Server-Side - BROKEN):
```
SignupForm → /api/auth/signup → Admin Client → httpOnly Cookie ✅
Redirect → Dashboard → Client SDK → Checks localStorage ❌ (empty!)
Result: "No active session found" error
```

**After** (Client-Side - FIXED):
```
SignupForm → Client SDK → Session → localStorage ✅
Redirect → Dashboard → Client SDK → Checks localStorage ✅
Result: Dashboard loads successfully
```

## Original File

See `route.ts.deprecated` in this directory for the original implementation.

## Test Evidence

- Test User: sessionfixtest@scottishailessons.com (User ID: 68e2b7f30023b0...)
- Console confirmed: Session created in localStorage
- Dashboard loaded without errors
- Student record synced successfully

## Migration Complete

Date: 2025-01-05
Verified by: Manual testing with Playwright MCP
