# Replit Frontend Deployment Guide

## 📋 Overview

This guide walks you through deploying the Scottish AI Lessons frontend to Replit. The frontend is configured with **fail-fast error handling** that will display clear error messages until the backend is properly connected.

**Important**: This deployment creates a **frontend-only** instance. Backend connectivity is required for full functionality. See `/BACKEND_DEPLOYMENT.md` for backend deployment instructions.

---

## 🚀 Quick Start

### Prerequisites

- Replit account (free or paid)
- API keys:
  - ✅ `OPENAI_API_KEY` (for AI features)
  - ✅ `ANTHROPIC_API_KEY` (if using Claude models)
  - ✅ `APPWRITE_API_KEY` (for authentication)
- Backend deployment (optional now, required for full functionality later)

---

## 📦 Step-by-Step Deployment

### Step 1: Create Replit Project

#### Option A: Import from GitHub

1. Go to https://replit.com
2. Click "Create Repl"
3. Select "Import from GitHub"
4. Enter repository URL:
   ```
   https://github.com/schoolofai/ScottishAILessons
   ```
5. Replit will detect the Node.js project automatically
6. Name your Repl: `scottish-ai-lessons-frontend`
7. Click "Import from GitHub"

#### Option B: Upload Files Manually

1. Go to https://replit.com
2. Click "Create Repl"
3. Choose "Node.js" template
4. Name: `scottish-ai-lessons-frontend`
5. Zip the `assistant-ui-frontend/` folder on your local machine
6. Upload and extract in Replit workspace
7. Ensure all configuration files are present:
   - `.replit` ✅
   - `replit.nix` ✅
   - `.env.replit` ✅ (template only)

---

### Step 2: Verify Configuration Files

Replit should auto-detect these files. Verify they exist:

#### `.replit`
```bash
ls -la .replit
```

Should contain runtime configuration for Next.js

#### `replit.nix`
```bash
ls -la replit.nix
```

Should contain Node.js 22 and TypeScript dependencies

#### `.env.replit`
```bash
ls -la .env.replit
```

This is a template - DO NOT use as-is. You'll configure actual secrets in the next step.

---

### Step 3: Configure Secrets

Click the **padlock icon (🔒)** in the left sidebar to open Secrets.

Add the following secrets:

#### Authentication (Appwrite)
```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=68adb98e0020be2e134f
APPWRITE_API_KEY=[your-appwrite-api-key]
```

**Where to get `APPWRITE_API_KEY`**:
1. Go to https://cloud.appwrite.io
2. Navigate to your project
3. Settings → API Keys
4. Create new key with server-side access
5. Copy and paste into Replit Secrets

#### AI Model API Keys
```
OPENAI_API_KEY=sk-[your-openai-key]
ANTHROPIC_API_KEY=sk-ant-[your-anthropic-key]
```

**Where to get API keys**:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys

#### Backend Configuration
```
NEXT_PUBLIC_LANGGRAPH_API_URL=https://placeholder-update-later.replit.app
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
```

**Important**: The `NEXT_PUBLIC_LANGGRAPH_API_URL` is a placeholder. The frontend will show an error message until you deploy the backend and update this URL.

#### App Configuration
```
NEXT_PUBLIC_APP_URL=https://[will-be-auto-generated].replit.app
NODE_ENV=production
```

**Note**: You'll update `NEXT_PUBLIC_APP_URL` after deployment when you know the actual Replit URL.

---

### Step 4: Install Dependencies

In the Replit Shell, run:

```bash
npm install --legacy-peer-deps
```

**Why `--legacy-peer-deps`?**
The project uses multiple React-based libraries with slightly different peer dependency requirements. This flag resolves version conflicts safely.

**Expected duration**: 2-5 minutes depending on network speed.

**Verify installation**:
```bash
ls node_modules | wc -l
```

Should show 1000+ packages.

---

### Step 5: Test Build Locally

Before deploying, test the build process:

```bash
npm run build
```

**Expected output**:
```
✓ Collecting page data
✓ Generating static pages (XX/XX)
✓ Finalizing page optimization
```

**If build fails**:
- Check for TypeScript errors (should be ignored due to `ignoreBuildErrors: true`)
- Verify all environment variables are set
- Check Shell output for specific error messages

---

### Step 6: Test Development Server

Run the development server locally in Replit:

```bash
npm run dev
```

**Expected output**:
```
▲ Next.js 15.3.0
- Local: http://localhost:3000
```

Click "Open in a new tab" in Replit to view the app.

**What you should see**:
- If backend is not deployed yet: **Backend Error UI** with clear instructions ✅
- If backend URL is still placeholder: **Backend Error UI** ✅
- Navigation and static pages should work ✅

**What won't work yet**:
- Chat functionality ❌
- Lesson sessions ❌
- Course management ❌

This is **expected behavior** - the fail-fast error handling is working correctly!

---

### Step 7: Deploy to Production

1. Click the **"Deploy"** button in Replit (top-right)
2. Choose deployment type:
   - **Autoscale** (recommended): Scales automatically based on traffic
   - **Reserved VM**: Fixed resources, better for consistent workloads
3. Configure resources:
   - **1 vCPU, 2 GiB RAM** is sufficient for most use cases
   - Increase if you experience performance issues
4. Confirm build command: `npm run build` ✅
5. Confirm run command: `npm run start` ✅
6. Click **"Deploy"** to start deployment

**Deployment duration**: 5-10 minutes for first deployment

**Monitor deployment**:
- Watch the deployment logs in real-time
- Look for "✓ Build complete" message
- Verify "Ready on port 3000" after build

---

### Step 8: Get Deployment URL

After deployment completes:

1. Copy the deployment URL (format: `https://[your-repl-name].[your-username].repl.co`)
2. Test the URL in a browser
3. You should see the **Backend Error UI** (this is correct behavior!)

---

### Step 9: Update App URL Secret

Now that you have the actual Replit URL:

1. Go back to Secrets (🔒)
2. Update `NEXT_PUBLIC_APP_URL` to your actual deployment URL:
   ```
   NEXT_PUBLIC_APP_URL=https://your-actual-repl-url.replit.app
   ```
3. **Restart the deployment** for changes to take effect

---

### Step 10: Configure Appwrite OAuth Callbacks

Your authentication needs to know about the new deployment URL:

1. Go to https://cloud.appwrite.io
2. Navigate to your project
3. Go to **Settings** → **OAuth Providers** (or **Domains** depending on setup)
4. Add your Replit URL to allowed domains:
   ```
   https://your-repl-url.replit.app
   ```
5. Add OAuth callback URL:
   ```
   https://your-repl-url.replit.app/api/auth/callback
   ```
6. Save changes

---

### Step 11: Test Authentication

1. Visit your deployed frontend URL
2. Try logging in with test credentials:
   - Email: `test@scottishailessons.com`
   - Password: `red12345`
3. Authentication should work ✅
4. After login, you'll see the dashboard
5. Trying to start a lesson will show the **Backend Error UI** ✅ (expected!)

---

## 🔗 Connecting Backend (When Ready)

Once you've deployed the backend (see `/BACKEND_DEPLOYMENT.md`):

### Update Backend URL

1. Open Replit Secrets (🔒)
2. Update `NEXT_PUBLIC_LANGGRAPH_API_URL`:
   ```
   NEXT_PUBLIC_LANGGRAPH_API_URL=https://your-backend-url.replit.app
   ```
3. **Important**: Use the base URL only (no `/api` suffix)

### Restart Frontend

1. Stop the current deployment
2. Clear any caches (optional)
3. Start/deploy again

### Verify Connection

1. Visit your frontend URL
2. Login
3. Try to start a lesson
4. You should now see the **chat interface** instead of the error UI ✅
5. Send a message to verify backend is responding

---

## 🐛 Troubleshooting

### Build Fails with "Out of Memory"

**Problem**: Build process crashes due to insufficient memory

**Solutions**:
1. Upgrade Replit plan for more RAM
2. Add swap file (advanced):
   ```bash
   fallocate -l 2G /tmp/swapfile
   chmod 600 /tmp/swapfile
   mkswap /tmp/swapfile
   swapon /tmp/swapfile
   ```
3. Build locally and upload `./next/` folder (not recommended)

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Stop all running processes: Click "Stop" button in Replit
2. Kill process manually:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```
3. Restart the server

### Environment Variables Not Loading

**Problem**: App shows "undefined" for environment variables

**Solutions**:
1. Verify secrets are set in Secrets tab (🔒)
2. Check variable names match exactly (case-sensitive)
3. Restart deployment after adding new secrets
4. For `NEXT_PUBLIC_*` variables, verify they're in Secrets (not `.env.local`)

### CSS Not Loading / Styles Broken

**Problem**: App loads but styles are missing

**Solutions**:
1. Clear `.next/` build cache:
   ```bash
   rm -rf .next
   npm run build
   ```
2. Verify Tailwind CSS is installed:
   ```bash
   npm list tailwindcss
   ```
3. Check `tailwind.config.ts` exists and is valid

### "Module not found" Errors

**Problem**: App crashes with import errors

**Solutions**:
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install --legacy-peer-deps
   ```
2. Clear npm cache:
   ```bash
   npm cache clean --force
   npm install --legacy-peer-deps
   ```

### Deployment Stuck on "Building..."

**Problem**: Deployment hangs indefinitely

**Solutions**:
1. Cancel deployment
2. Check build logs for errors
3. Try deploying again (sometimes Replit has transient issues)
4. If persistent, contact Replit support

### Backend Error UI Shows Wrong URL

**Problem**: Error UI displays old/incorrect backend URL

**Solutions**:
1. Verify `NEXT_PUBLIC_LANGGRAPH_API_URL` is updated in Secrets
2. Restart deployment (changes require restart)
3. Clear browser cache
4. Check in incognito/private window

---

## 📊 Monitoring Your Deployment

### View Logs

Click the **"Logs"** tab in Replit deployment dashboard to see:
- Application startup logs
- Request logs
- Error logs
- Performance metrics

### Monitor Performance

Watch for:
- **Response time**: Should be < 3s for initial load
- **Build time**: Should be < 5 minutes
- **Memory usage**: Should stay below 80%
- **Error rate**: Should be < 1%

### Set Up Alerts

For production deployments:
1. Enable Replit monitoring (if available on your plan)
2. Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
3. Configure Slack/email alerts for downtime

---

## 🔒 Security Best Practices

### Secrets Management
- ✅ Always use Replit Secrets for sensitive data
- ❌ Never commit `.env.local` or `.env` to Git
- ✅ Rotate API keys periodically
- ✅ Use separate keys for development and production

### Access Control
- Use Replit's team features to manage access
- Don't share your Replit account credentials
- Use read-only access for viewers

### CORS Configuration
- Update backend CORS to only allow your Replit frontend domain
- Don't use wildcard (`*`) origins in production

---

## 📈 Scaling & Performance

### Upgrade Plan

If experiencing performance issues:

**Free Plan**:
- Limited CPU/RAM
- Slower builds
- May sleep after inactivity

**Hacker Plan** ($7/month):
- More resources
- Faster builds
- Always-on deployments

**Pro Plan** ($20/month):
- Reserved VMs
- Private deployments
- Priority support

### Optimization Tips

1. **Enable Next.js optimizations**:
   - Image optimization (already configured)
   - Automatic code splitting
   - Static generation where possible

2. **Reduce bundle size**:
   ```bash
   npm run build -- --profile
   ```
   Analyze bundle and remove unused dependencies

3. **Use dynamic imports** for heavy components:
   ```typescript
   const Excalidraw = dynamic(() => import('@excalidraw/excalidraw'), {
     ssr: false
   });
   ```

4. **Enable caching**:
   - Replit automatically caches `node_modules`
   - Configure CDN for static assets (advanced)

---

## 🎯 Next Steps

After successful deployment:

1. ✅ Frontend is live and accessible
2. ✅ Authentication works via Appwrite
3. ✅ Error handling shows clear messages
4. ⏳ Deploy backend (see `/BACKEND_DEPLOYMENT.md`)
5. ⏳ Connect backend to frontend
6. ⏳ Test full lesson flow
7. ⏳ Set up monitoring and alerts
8. ⏳ Configure custom domain (optional)

---

## 📚 Additional Resources

- [Replit Docs](https://docs.replit.com/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Appwrite OAuth Setup](https://appwrite.io/docs/authentication)
- [Backend Deployment Guide](/BACKEND_DEPLOYMENT.md)

---

## 🆘 Getting Help

If you encounter issues:

1. Check the Troubleshooting section above
2. Review deployment logs in Replit
3. Check [GitHub Issues](https://github.com/schoolofai/ScottishAILessons/issues)
4. Ask in Replit Community Forums
5. Contact Replit Support (paid plans)

---

**Last Updated**: 2025-01-14
**Version**: 1.0.0
**Configuration Files**: `.replit`, `replit.nix`, `.env.replit`
