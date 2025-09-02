# Appwrite Credentials and Configuration

## ✅ Current Setup Status

### 1. **Appwrite Backend Configuration**
All credentials are properly configured and stored in `.env.local`:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=671e61db002e5c38eed0
APPWRITE_API_KEY=standard_2fe8fe99b656f0cf59c5b2dd2e37fb0f1e5e45ea14e04ce0a893bb1ade9cd7e0583e87bb0e3f17a4e3b4ff18a093c4bb973b37e7ded5bb4fb6fa00f7a1e006b5b5f9c2fa8f95de5c5f96c0f1bb4e86c42c604ae9c8b959e3d72fcb0e17c96a7c0bd6e80e99c18c0f83a36f93c3e6e72f2c080b08e2c963acd079f57aca326cf9b
```

### 2. **Database Structure Created**
✅ **Database**: `default` - Scottish AI Lessons
✅ **Collection**: `students` - Stores user metadata
✅ **Attributes**:
   - `userId` (string, 36 chars, required) - Links to Appwrite user ID
   - `name` (string, 128 chars, required) - User's display name
   - `role` (string, 20 chars, optional, default: "student") - User role

### 3. **Where Credentials Are Used**

#### Production Code:
- `lib/appwrite/client.ts` - Reads from environment variables
- `lib/appwrite/server.ts` - Server-side authentication functions
- `app/api/auth/*/route.ts` - All auth API endpoints

#### Environment Files:
- `.env.local` - Active configuration (real Appwrite)
- `.env.local.appwrite` - Backup of Appwrite configuration
- `.env.test` - Previously had mock values (needs updating for real E2E)

### 4. **Authentication Flow**
The system uses real Appwrite services for:
- User registration (`account.create()`)
- Email/password login (`account.createEmailPasswordSession()`)
- Session management (cookies with session secrets)
- User metadata sync (students collection)

## 🧪 Real E2E Testing Setup

### Available Test Commands:
```bash
# Run real E2E tests with actual Appwrite backend
npm run test:e2e

# Run with visible browser (for debugging)
npm run test:e2e:headed
```

### Test File:
`tests/e2e-real-auth.spec.ts` - Complete authentication journey tests using real Appwrite

### Test Features:
- ✅ Dynamic test user generation (unique emails each run)
- ✅ Real user creation in Appwrite
- ✅ Real authentication flows (signup, login, logout)
- ✅ Real session management testing
- ✅ Real middleware protection testing
- ✅ No mocks - everything hits actual Appwrite backend

## ⚠️ Important Notes

1. **Test Users**: Test users are created with pattern `e2e.test.*@playwright.local`
2. **Cleanup**: Test users remain in Appwrite after tests (manual cleanup needed)
3. **Internet Required**: Tests require connection to Appwrite cloud
4. **Rate Limits**: Be aware of Appwrite rate limits when running tests repeatedly

## 🔐 Security Notes

- API key has full admin access - keep secure
- Never commit `.env.local` to version control
- Use environment-specific credentials for production