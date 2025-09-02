# Authentication Setup Guide

## Overview
This Next.js application now includes a complete authentication system using Appwrite with the following features:
- Email/password authentication
- Google OAuth integration
- Password reset functionality
- Protected routes with middleware
- Session management via HttpOnly cookies
- Automatic user sync to students collection

## Setup Instructions

### 1. Configure Appwrite

First, create an Appwrite project and configure the following:

#### Create Database & Collection
Use the Appwrite MCP tools or console to create:
- Database: `default`
- Collection: `students` with owner-only permissions
- Attributes:
  - `userId` (string, required, unique)
  - `name` (string)
  - `role` (enum: "student" | "teacher")
- Index: Unique index on `userId`

#### Enable Authentication Methods
1. Go to Appwrite Console → Auth
2. Enable Email/Password authentication
3. Enable Google OAuth provider (add your OAuth credentials)

### 2. Environment Configuration

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Existing LangGraph Configuration
NEXT_PUBLIC_ASSISTANT_ID=agent
NEXT_PUBLIC_API_URL=http://localhost:2024
```

### 3. Run the Application

```bash
npm install --legacy-peer-deps
npm run dev
```

## Application Structure

### User Flow
1. **Landing Page** (`/`) - Public homepage with login/signup CTAs
2. **Login** (`/login`) - Email/password or Google sign-in
3. **Signup** (`/signup`) - Create new account
4. **Password Reset** (`/reset-password`) - Recovery flow
5. **Chat Interface** (`/chat`) - Protected route, requires authentication

### Key Files

#### Authentication Components
- `components/auth/LoginForm.tsx` - Login form
- `components/auth/SignupForm.tsx` - Registration form
- `components/auth/GoogleButton.tsx` - OAuth button
- `components/auth/ResetPasswordForm.tsx` - Password reset

#### API Routes
- `/api/auth/login` - Email/password login
- `/api/auth/signup` - Account creation
- `/api/auth/logout` - Session termination
- `/api/auth/google` - OAuth initiation
- `/api/auth/google/callback` - OAuth callback
- `/api/auth/recovery` - Password recovery email
- `/api/auth/recovery/confirm` - Password reset confirmation

#### Configuration
- `lib/appwrite/client.ts` - Appwrite client setup
- `lib/appwrite/server.ts` - Server-side helpers
- `lib/appwrite/auth.ts` - Auth utilities
- `middleware.ts` - Route protection

## Security Features

1. **HttpOnly Cookies**: Session tokens stored in HttpOnly, Secure, SameSite=strict cookies
2. **Server-Side Validation**: All auth operations use server-side SDK
3. **Protected Routes**: Middleware automatically redirects unauthenticated users
4. **Owner Permissions**: Users can only access their own student documents
5. **Input Validation**: Email and password validation on both client and server

## Testing the Authentication

### Test Email/Password Flow
1. Navigate to `/signup`
2. Create a new account
3. Verify redirect to `/chat`
4. Logout and login again
5. Test password reset from login page

### Test Google OAuth
1. Click "Continue with Google" on login/signup page
2. Complete Google authentication
3. Verify redirect to `/chat`
4. Check students collection for synced user

### Test Protected Routes
1. Logout (clear cookies)
2. Try accessing `/chat` directly
3. Verify redirect to `/login`
4. Login and verify access to `/chat`

## Troubleshooting

### Common Issues

1. **Build Errors**: Run with `--legacy-peer-deps` flag due to peer dependency conflicts
2. **OAuth Not Working**: Ensure Google OAuth is configured in Appwrite Console
3. **Session Issues**: Check cookie settings in browser developer tools
4. **Database Sync Fails**: Verify API key has proper permissions

### Development Tips

- Use browser DevTools to inspect cookies
- Check Network tab for API responses
- Monitor Appwrite Console for auth events
- Test with incognito mode for clean sessions

## Next Steps

1. Add user profile page
2. Implement role-based access control
3. Add social login providers (GitHub, Microsoft)
4. Implement session refresh logic
5. Add email verification flow
6. Create admin dashboard for teachers