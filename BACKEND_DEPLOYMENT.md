# Backend Deployment Guide

## 📋 Current Status

**Frontend Deployment**: ✅ Ready to deploy to Replit
**Backend Deployment**: ⏳ Pending - Required for full functionality

## 🎯 Overview

The Scottish AI Lessons frontend is now configured for Replit deployment with **fail-fast error handling** for backend connectivity. The application will display clear error messages until the backend is properly deployed and connected.

### What Works Without Backend
- ✅ User authentication (Appwrite Cloud)
- ✅ Static pages and navigation
- ✅ User profile management
- ✅ UI rendering and styling

### What Requires Backend
- ❌ Chat functionality
- ❌ Lesson sessions and teaching interactions
- ❌ Course recommendations
- ❌ Course management operations
- ❌ Progress tracking
- ❌ Context-aware AI tutoring

---

## 🚀 Backend Deployment Options

### Option 1: Deploy to Replit (Recommended for Prototyping)

#### Step 1: Create Backend Replit Project

1. Go to https://replit.com
2. Click "Create Repl"
3. Choose "Python" template
4. Name: `scottish-ai-lessons-backend`

#### Step 2: Upload Backend Code

Upload the `langgraph-agent/` directory:
- `src/` - Agent code
- `langgraph.json` - LangGraph configuration
- `pyproject.toml` - Python dependencies
- `.env.example` - Environment template

#### Step 3: Create Backend Configuration Files

**Create `.replit`**:
```toml
run = "langgraph dev"
entrypoint = "src/agent/graph_interrupt.py"
hidden = [".config", ".pythonlibs", "__pycache__"]

[nix]
channel = "stable-24_11"

[deployment]
build = ["pip", "install", "-e", ".", "langgraph-cli[inmem]"]
run = ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 2024
externalPort = 80
```

**Create `replit.nix`**:
```nix
{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
  ];
}
```

#### Step 4: Configure Backend Secrets

Add these to Replit Secrets (padlock icon):
```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
APPWRITE_API_KEY=your-appwrite-api-key
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=68adb98e0020be2e134f
APPWRITE_DATABASE_ID=your-database-id
```

#### Step 5: Install Dependencies

```bash
pip install -e . "langgraph-cli[inmem]"
```

#### Step 6: Test Backend Locally

```bash
langgraph dev
```

Verify at: `http://localhost:2024/docs`

#### Step 7: Deploy Backend

1. Click "Deploy" in Replit
2. Choose deployment type
3. Wait for deployment to complete
4. Note the public URL: `https://[your-backend].replit.app`

#### Step 8: Verify Backend Health

Test the health endpoint:
```bash
curl https://[your-backend].replit.app/health
```

Should return:
```json
{"status": "healthy"}
```

---

### Option 2: Deploy to Railway (Recommended for Production)

Railway provides better scalability and performance for production workloads.

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

#### Step 2: Initialize Railway Project

```bash
cd langgraph-agent
railway init
```

#### Step 3: Configure Railway Environment

```bash
# Set environment variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set APPWRITE_API_KEY=...
railway variables set APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
railway variables set APPWRITE_PROJECT_ID=68adb98e0020be2e134f
```

#### Step 4: Create Dockerfile

**Create `Dockerfile` in `langgraph-agent/`**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ ./src/
COPY langgraph.json .

RUN pip install --no-cache-dir -e . "langgraph-cli[inmem]"

EXPOSE 2024

CMD ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024"]
```

#### Step 5: Deploy to Railway

```bash
railway up
```

Get deployment URL:
```bash
railway domain
```

---

### Option 3: Deploy to Render

Render offers a simple deployment workflow with automatic scaling.

#### Step 1: Create Render Account

Go to https://render.com and sign up

#### Step 2: Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select the `langgraph-agent/` directory

#### Step 3: Configure Build & Start Commands

- **Build Command**: `pip install -e . "langgraph-cli[inmem]"`
- **Start Command**: `langgraph dev --host 0.0.0.0 --port 2024`

#### Step 4: Set Environment Variables

Add in Render Dashboard:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `APPWRITE_API_KEY`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_DATABASE_ID`

#### Step 5: Deploy

Click "Create Web Service" - Render will build and deploy automatically

---

## 🔗 Connecting Frontend to Backend

Once your backend is deployed:

### Step 1: Get Backend URL

Copy the public URL of your deployed backend, for example:
- Replit: `https://scottish-ai-lessons-backend.your-username.repl.co`
- Railway: `https://your-app.railway.app`
- Render: `https://your-service.onrender.com`

### Step 2: Update Frontend Environment Variable

In your **frontend Replit project**, update the Secret:

```
NEXT_PUBLIC_LANGGRAPH_API_URL=https://your-backend-url-here
```

**Important**: Remove any `/api` suffix - just the base URL.

### Step 3: Restart Frontend Deployment

1. Stop the frontend (if running)
2. Clear the build cache (optional but recommended)
3. Start the frontend again

### Step 4: Verify Connection

1. Visit your frontend URL
2. You should now see the chat interface (no error message)
3. Try sending a message to verify backend connectivity

---

## 🧪 Testing Backend Deployment

### Health Check
```bash
curl https://your-backend-url/health
```

Expected response:
```json
{"status": "healthy", "version": "1.0.0"}
```

### API Documentation
Visit: `https://your-backend-url/docs`

Should show FastAPI/LangGraph API documentation

### Test Chat Endpoint
```bash
curl -X POST https://your-backend-url/runs/stream \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "Hello"}]},
    "config": {"configurable": {"thread_id": "test-thread"}},
    "stream_mode": "values"
  }'
```

Should return streaming SSE events with AI responses

---

## 🔧 Troubleshooting

### Backend Not Responding

**Problem**: `curl: (7) Failed to connect`

**Solutions**:
1. Check if backend is running: `railway logs` or check Replit console
2. Verify firewall/port settings allow external connections
3. Check backend logs for startup errors

### 404 Not Found

**Problem**: `404: Not Found` when accessing health endpoint

**Solutions**:
1. Verify backend is using correct port (2024)
2. Check if health endpoint is implemented in your graph
3. Ensure LangGraph CLI is properly configured in `langgraph.json`

### CORS Errors

**Problem**: Frontend shows CORS error in browser console

**Solutions**:
1. Add CORS middleware to backend
2. Configure `allowed_origins` in LangGraph settings
3. Ensure frontend URL is whitelisted in backend CORS config

### Backend Timeout

**Problem**: Frontend shows "Request timeout (5s)"

**Solutions**:
1. Check backend cold start time (increase timeout in `backend-status.ts` if needed)
2. Verify backend has enough resources (RAM, CPU)
3. Check if backend is overloaded (consider scaling up)

### Environment Variables Not Loading

**Problem**: Backend crashes with missing API keys

**Solutions**:
1. Verify all required secrets are set in deployment platform
2. Check secret names match exactly (case-sensitive)
3. Restart backend after adding new secrets

---

## 📊 Monitoring & Maintenance

### Logs

- **Replit**: View logs in the console tab
- **Railway**: `railway logs -f`
- **Render**: View logs in dashboard → Logs tab

### Metrics

Monitor these metrics:
- Response time (should be < 2s for most requests)
- Error rate (should be < 1%)
- Uptime (target: 99.9%)
- Memory usage (should stay below 80%)

### Scaling

If you experience performance issues:

**Replit**:
- Upgrade to Reserved VM (more CPU/RAM)
- Enable always-on (prevents cold starts)

**Railway**:
- Adjust replicas: `railway scale --replicas 3`
- Increase memory: `railway up --memory 2GB`

**Render**:
- Change instance type in dashboard
- Enable auto-scaling for production

---

## 🔐 Security Considerations

### API Keys
- ✅ Store API keys in platform secrets (never in code)
- ✅ Use environment variables
- ✅ Rotate keys periodically
- ❌ Never commit `.env` files to git
- ❌ Never expose server-side keys to frontend

### CORS
- Configure `allowed_origins` to only include your frontend domain
- Don't use `*` (allow all) in production

### Authentication
- Implement API key authentication for backend
- Use rate limiting to prevent abuse
- Consider adding request signing for extra security

---

## 📝 Next Steps After Backend Deployment

1. ✅ Deploy backend to chosen platform
2. ✅ Test health endpoint
3. ✅ Update frontend `NEXT_PUBLIC_LANGGRAPH_API_URL`
4. ✅ Restart frontend
5. ✅ Test chat functionality end-to-end
6. ✅ Update Appwrite OAuth callbacks to include backend URL (if needed)
7. ✅ Monitor logs for errors
8. ✅ Set up monitoring/alerting for production

---

## 📚 Additional Resources

- [LangGraph Deployment Docs](https://langchain-ai.github.io/langgraph/deployment/)
- [Replit Deployment Guide](https://docs.replit.com/hosting/deployments/about-deployments)
- [Railway Deployment Guide](https://docs.railway.app/deploy/deployments)
- [Render Deployment Guide](https://render.com/docs)

---

## 🆘 Need Help?

If you encounter issues:

1. Check backend logs for error messages
2. Verify all environment variables are set correctly
3. Test backend health endpoint
4. Review this guide's troubleshooting section
5. Check the [GitHub Issues](https://github.com/schoolofai/ScottishAILessons/issues)

---

**Last Updated**: 2025-01-14
**Version**: 1.0.0
