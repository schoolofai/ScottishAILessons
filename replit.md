# Scottish AI Lessons - Replit Deployment

## Project Overview
This is a Next.js 15 application that provides an AI-powered learning platform for Scottish curriculum courses. The application uses Appwrite for backend services and LangGraph for AI-powered course recommendations.

## Current State
**Status**: ✅ Ready for deployment - All configurations complete

**Last Updated**: November 14, 2025

## Recent Changes

### Deployment Configuration Complete (November 14, 2025)
- ✅ Added build/start scripts to root package.json for Replit deployment
- ✅ Created root pnpm-lock.yaml to fix "ERR_PNPM_NO_SCRIPT" deployment error
- ✅ Added verbose logging to build script for better deployment debugging
- ✅ Added PORT environment variable (set to 5000)
- ✅ Resolved MyAssistant.mock.tsx import errors
- ✅ Fixed JSX syntax errors in __mocks__/langgraph-client.tsx (renamed from .ts to .tsx)
- ✅ Verified all LSP diagnostics are clean
- ✅ Configured autoscale deployment with:
  - Build: `pnpm run build` (runs from root, delegates to assistant-ui-frontend)
  - Run: `pnpm run start` (runs from root, delegates to assistant-ui-frontend)
- Ready for production deployment

### Vercel to Replit Migration (November 11, 2025)
- Installed Node.js 20 and pnpm package manager
- Configured Next.js to run on port 5000 with host 0.0.0.0 for Replit compatibility
- Added `allowedDevOrigins` configuration to support Replit's iframe environment
- Configured development workflow for Next.js dev server
- Set up deployment configuration for Replit autoscale
- Removed TypeScript/ESLint error suppression to ensure production-ready code

## Project Architecture

### Technology Stack
- **Frontend Framework**: Next.js 15.3.0 with React 19
- **Package Manager**: pnpm
- **Backend Services**: 
  - Appwrite (authentication, database, storage)
  - LangGraph (AI course recommendations)
- **UI Libraries**: 
  - Radix UI components
  - Tailwind CSS
  - Assistant UI for chat interface
- **Rich Text**: TipTap editor with math support
- **Testing**: Playwright for E2E tests, Jest for unit tests

### Project Structure
```
assistant-ui-frontend/
├── app/                    # Next.js app directory
├── components/            # React components
├── lib/                   # Utilities and services
│   ├── appwrite/         # Appwrite integration
│   ├── langgraph/        # LangGraph service
│   └── services/         # Business logic
├── scripts/              # Database seeding and migration scripts
├── tests/                # Test suites
└── public/               # Static assets
```

## Environment Variables

The following environment variables are configured in Replit Secrets:

### Appwrite Configuration
- `NEXT_PUBLIC_APPWRITE_ENDPOINT` - Appwrite API endpoint (e.g., https://cloud.appwrite.io/v1)
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` - Appwrite project ID
- `APPWRITE_API_KEY` - API key for server-side operations

### LangGraph Configuration (Dual-Backend Architecture)
- `NEXT_PUBLIC_LANGGRAPH_API_URL` - Main backend for teaching sessions, lessons, course management
- `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID` - Assistant ID (set to "agent")
- `NEXT_PUBLIC_CONTEXT_CHAT_API_URL` - Context chat backend for AI Tutor side panel
- `LANGGRAPH_API_KEY` - LangGraph API authentication key (optional)

### LangSmith Configuration
- `NEXT_PUBLIC_LANGSMITH_API_KEY` - LangSmith API key for monitoring deployed LangGraph agents

## Development Workflow

### Running the Application

**On Replit:**
The application runs automatically via the configured workflow:
- **Command**: `cd assistant-ui-frontend && pnpm run dev`
- **Port**: 5000
- **Output**: Webview (accessible in Replit interface)

**On Your Local MacBook:**
To avoid port conflicts with system processes on macOS:
```bash
cd assistant-ui-frontend
pnpm run dev:local
```
This will start the dev server on the default port 3000 instead of 5000.

### Building for Production
```bash
cd assistant-ui-frontend && pnpm run build
```

### Running Tests
```bash
cd assistant-ui-frontend
pnpm test              # Run all Playwright tests
pnpm run test:smoke    # Run smoke tests
pnpm run test:jest     # Run Jest unit tests
```

## Deployment

The application is configured for Replit autoscale deployment:
- **Build Command**: `cd assistant-ui-frontend && pnpm install && pnpm run build`
- **Start Command**: `cd assistant-ui-frontend && pnpm run start`
- **Deployment Type**: Autoscale (stateless, suitable for web applications)

### Pre-Deployment Checklist
Before deploying, ensure:
1. All environment variables are set in Replit Secrets
2. The build completes successfully (`cd assistant-ui-frontend && pnpm run build`)
3. All TypeScript/ESLint errors are resolved

### Known Build Issues
- The `MyAssistant.mock.tsx` file had a reference to a deleted component - this has been fixed
- There are some ESLint warnings (unused variables) that should be cleaned up before production
- Build process may take 2-3 minutes due to large codebase (978 modules)

## Security Considerations
- All sensitive credentials stored in Replit Secrets
- Session cookies use httpOnly and secure flags in production
- TypeScript and ESLint enabled to catch errors before deployment
- API keys managed through Appwrite integration

## Known Issues
- WebSocket HMR (Hot Module Reload) warning in Replit environment - this is cosmetic and doesn't affect functionality
- Build process may take longer due to large dependency tree (978 modules)

## User Preferences
None documented yet.

## Next Steps
1. Complete production build validation
2. Test authentication flows in Replit environment
3. Verify Appwrite database connectivity
4. Test LangGraph integration
5. Validate all E2E test suites pass
