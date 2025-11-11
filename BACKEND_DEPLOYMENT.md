# Backend Deployment Guide

## 📋 Current Status

**Frontend Deployment**: ✅ Ready to deploy to Replit
**Main Backend Deployment**: ⏳ Pending - Deploy to LangGraph Platform
**Context Chat Backend Deployment**: ⏳ Pending - Deploy to LangGraph Platform

## 🎯 Overview

The Scottish AI Lessons system uses a **dual-backend architecture** where the frontend requires **TWO backends**, both deployed to **LangGraph Platform**. The frontend displays fail-fast error messages until both backends are properly deployed and connected.

### Architecture

```
┌──────────────────────────────────────────┐
│   Frontend (Replit)                      │
│   - Next.js/React Application            │
│   - Port 3000                            │
└──────────┬────────────────┬──────────────┘
           │                │
           │                │
    ┌──────▼─────┐   ┌──────▼──────────┐
    │ Main       │   │ Context Chat    │
    │ Backend    │   │ Backend         │
    │            │   │                 │
    │ Port 2024  │   │ Port 2700       │
    │ (Required) │   │ (Required)      │
    └────────────┘   └─────────────────┘
         │                    │
         │  LangGraph Cloud   │
         └────────────────────┘
```

---

## 🏗️ Dual-Backend Architecture

### Main Backend (`langgraph-agent/`)
**Purpose**: Core teaching functionality
**Port**: 2024 (local) / 80 (deployed)
**Handles**:
- Teaching sessions and lesson progression
- Course management operations
- Lesson delivery and interactive cards
- Student progress tracking
- Learning outcomes evaluation

### Context Chat Backend (`langgraph-generic-chat/`)
**Purpose**: AI Tutor side panel
**Port**: 2700 (local) / 80 (deployed)
**Handles**:
- Contextual help during lessons
- AI Tutor side panel functionality
- Q&A without disrupting main lesson flow
- Reference lookups and clarifications

### Why Two Backends?

1. **Separation of Concerns**: Teaching flow remains uninterrupted by help requests
2. **Independent Scaling**: AI tutor can scale separately from main teaching backend
3. **Resource Isolation**: Context chat's heavy LLM usage doesn't impact lesson delivery
4. **Development Flexibility**: Teams can work on features independently

---

## 🚀 Deploying to LangGraph Platform

### Prerequisites

Before deploying, ensure you have:

- ✅ LangGraph Platform account (https://langchain.com)
- ✅ LangGraph CLI installed: `pip install -U "langgraph-cli[inmem]"`
- ✅ API Keys ready:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY` (if using Claude)
  - `APPWRITE_API_KEY`
- ✅ Project environment configured

---

## 📦 Step-by-Step Deployment

### Part 1: Deploy Main Backend

#### Step 1: Navigate to Main Backend Directory

```bash
cd langgraph-agent
```

#### Step 2: Verify Configuration

Check `langgraph.json`:
```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph_interrupt.py:graph_interrupt"
  },
  "env": ".env"
}
```

#### Step 3: Configure Environment Variables

Create `.env` file (if not exists):
```bash
cp .env.example .env
```

Required variables:
```env
# AI Model API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Appwrite (Database & Auth)
APPWRITE_API_KEY=your-appwrite-api-key
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=68adb98e0020be2e134f
APPWRITE_DATABASE_ID=your-database-id

# App Configuration
FRONTEND_URL=https://your-frontend.replit.app
```

#### Step 4: Test Locally First

```bash
# Install dependencies
pip install -e . "langgraph-cli[inmem]"

# Run locally
langgraph dev

# Verify at http://localhost:2024/docs
curl http://localhost:2024/docs
```

#### Step 5: Deploy to LangGraph Platform

```bash
# Login to LangGraph Platform
langgraph login

# Deploy the main backend
langgraph deploy --name scottish-ai-main-backend

# Follow prompts to configure:
# - Environment variables
# - Resource allocation
# - Scaling settings
```

#### Step 6: Note the Deployment URL

After deployment, you'll receive a URL like:
```
https://scottish-ai-main-backend-abc123.langchain.app
```

**Save this URL** - you'll need it for frontend configuration.

#### Step 7: Verify Main Backend Health

```bash
# Test health endpoint
curl https://scottish-ai-main-backend-abc123.langchain.app/health

# Expected response:
# {"status": "healthy"}
```

---

### Part 2: Deploy Context Chat Backend

#### Step 1: Navigate to Context Chat Directory

```bash
cd ../langgraph-generic-chat
```

#### Step 2: Verify Configuration

Check `langgraph.json` for the context chat graph configuration.

#### Step 3: Configure Environment Variables

Create `.env` file:
```bash
cp .env.example .env
```

Required variables (same API keys as main backend):
```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
APPWRITE_API_KEY=your-appwrite-api-key
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=68adb98e0020be2e134f
```

#### Step 4: Test Locally

```bash
# Install dependencies (if not already in shared venv)
pip install -e . "langgraph-cli[inmem]"

# Run on different port (to avoid conflict with main backend)
langgraph dev --port 2700

# Verify at http://localhost:2700/docs
curl http://localhost:2700/docs
```

#### Step 5: Deploy to LangGraph Platform

```bash
# Deploy context chat backend
langgraph deploy --name scottish-ai-context-chat

# Configure environment variables and resources
```

#### Step 6: Note the Deployment URL

You'll receive a URL like:
```
https://scottish-ai-context-chat-xyz789.langchain.app
```

**Save this URL** - you'll need it for frontend configuration.

#### Step 7: Verify Context Chat Backend Health

```bash
curl https://scottish-ai-context-chat-xyz789.langchain.app/health
```

---

## 🔗 Connecting Frontend to Backends

Once BOTH backends are deployed:

### Step 1: Collect Backend URLs

- Main Backend: `https://scottish-ai-main-backend-abc123.langchain.app`
- Context Chat: `https://scottish-ai-context-chat-xyz789.langchain.app`

### Step 2: Update Frontend Environment Variables

In your **Replit frontend project**, open Secrets (🔒) and update:

```
NEXT_PUBLIC_LANGGRAPH_API_URL=https://scottish-ai-main-backend-abc123.langchain.app
NEXT_PUBLIC_CONTEXT_CHAT_API_URL=https://scottish-ai-context-chat-xyz789.langchain.app
```

**Important**: Remove any `/api` suffix - use base URLs only.

### Step 3: Restart Frontend Deployment

1. Stop the frontend (if running)
2. Clear Next.js cache (optional): `rm -rf .next`
3. Start/deploy frontend again

### Step 4: Verify Full System Connection

1. Visit your frontend URL
2. You should no longer see backend error messages ✅
3. Try starting a lesson - chat interface should load ✅
4. Open AI Tutor side panel - should work ✅
5. All backend-dependent features should be functional ✅

---

## 🧪 Testing Backend Deployments

### Health Checks

```bash
# Main Backend
curl https://scottish-ai-main-backend-abc123.langchain.app/health

# Context Chat Backend
curl https://scottish-ai-context-chat-xyz789.langchain.app/health

# Both should return: {"status": "healthy"}
```

### API Documentation

Visit the auto-generated API docs:
- Main: `https://scottish-ai-main-backend-abc123.langchain.app/docs`
- Context Chat: `https://scottish-ai-context-chat-xyz789.langchain.app/docs`

### Test Main Backend Chat Endpoint

```bash
curl -X POST https://scottish-ai-main-backend-abc123.langchain.app/runs/stream \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "Hello"}]},
    "config": {"configurable": {"thread_id": "test-thread"}},
    "stream_mode": "values"
  }'
```

Expected: Streaming SSE events with AI responses.

### Test Context Chat Backend

```bash
curl -X POST https://scottish-ai-context-chat-xyz789.langchain.app/runs/stream \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "What is photosynthesis?"}]},
    "config": {"configurable": {"thread_id": "test-help-thread"}},
    "stream_mode": "values"
  }'
```

Expected: Contextual help response.

---

## 🔧 Troubleshooting

### Backend Not Responding

**Problem**: `curl: (6) Could not resolve host`

**Solutions**:
1. Verify deployment URL is correct (check LangGraph dashboard)
2. Check if backend is still deploying (deployments take 2-5 minutes)
3. Verify DNS propagation (may take a few minutes)

### 404 Not Found

**Problem**: `404: Not Found` when accessing health endpoint

**Solutions**:
1. Verify `langgraph.json` configuration is correct
2. Check if graph is properly exported in entry file
3. Review deployment logs in LangGraph dashboard

### CORS Errors

**Problem**: Frontend shows CORS error in browser console

**Solutions**:
1. Add frontend URL to backend allowed origins
2. Configure `cors_origins` in LangGraph deployment settings
3. Ensure frontend domain is whitelisted

### Backend Timeout

**Problem**: Frontend shows "Request timeout (5s)"

**Solutions**:
1. Check backend cold start time (first request after idle may be slow)
2. Increase timeout in `backend-status.ts` if needed (currently 5s)
3. Consider enabling "always on" in LangGraph Platform settings

### Environment Variables Not Loading

**Problem**: Backend crashes with "API key not found"

**Solutions**:
1. Verify all secrets are set in LangGraph Platform dashboard
2. Check secret names match exactly (case-sensitive)
3. Redeploy after adding new secrets

### Feature Works Locally But Not in Production

**Problem**: Feature works with `langgraph dev` but fails when deployed

**Solutions**:
1. Check if local `.env` has variables missing from deployment config
2. Verify file paths are relative, not absolute
3. Check for dependencies that need to be in `pyproject.toml`

---

## 📊 Monitoring & Maintenance

### Logs

Access logs through LangGraph Platform dashboard:
- Navigate to your deployment
- Click "Logs" tab
- Filter by error level or time range

### Metrics

Monitor in LangGraph dashboard:
- **Response Time**: Should be < 2s for most requests
- **Error Rate**: Should be < 1%
- **Uptime**: Target 99.9%
- **Memory Usage**: Should stay below 80%

### Scaling

LangGraph Platform auto-scales based on traffic:
- Configure min/max instances in deployment settings
- Set memory limits per instance
- Adjust based on usage patterns

### Updates & Redeployments

```bash
# Update code locally
git pull

# Redeploy main backend
cd langgraph-agent
langgraph deploy --name scottish-ai-main-backend

# Redeploy context chat
cd ../langgraph-generic-chat
langgraph deploy --name scottish-ai-context-chat
```

---

## 🔐 Security Considerations

### API Keys
- ✅ Store keys in LangGraph Platform secrets (encrypted at rest)
- ✅ Use separate keys for dev/staging/production
- ✅ Rotate keys periodically (quarterly)
- ❌ Never commit `.env` files to git
- ❌ Never expose server-side keys to frontend

### CORS
- Configure `cors_origins` to only include your frontend domain
- Don't use `*` (allow all) in production
- Review CORS logs regularly for unauthorized access attempts

### Authentication
- LangGraph Platform handles authentication automatically
- API endpoints require valid auth tokens
- Rate limiting is built-in to prevent abuse

### Data Privacy
- Student data is processed but not stored in backends (stored in Appwrite)
- LLM API calls may log prompts/responses (review provider policies)
- Ensure compliance with GDPR/CCPA if handling EU/CA data

---

## 📝 Deployment Checklist

### Before Deploying

- [ ] Test both backends locally (`langgraph dev`)
- [ ] Verify all environment variables are set
- [ ] Check `langgraph.json` configuration
- [ ] Review and update dependencies in `pyproject.toml`
- [ ] Test API endpoints with curl/Postman

### During Deployment

- [ ] Deploy main backend to LangGraph Platform
- [ ] Note main backend URL
- [ ] Verify main backend health check passes
- [ ] Deploy context chat backend to LangGraph Platform
- [ ] Note context chat backend URL
- [ ] Verify context chat health check passes

### After Deployment

- [ ] Update frontend `NEXT_PUBLIC_LANGGRAPH_API_URL` in Replit Secrets
- [ ] Update frontend `NEXT_PUBLIC_CONTEXT_CHAT_API_URL` in Replit Secrets
- [ ] Restart frontend deployment
- [ ] Test frontend → main backend connection
- [ ] Test frontend → context chat backend connection
- [ ] Start a lesson and verify teaching flow
- [ ] Open AI Tutor panel and verify context chat
- [ ] Monitor logs for errors
- [ ] Set up alerts for downtime

---

## 🆘 Getting Help

If you encounter issues:

1. **Check LangGraph Platform documentation**: https://langchain-ai.github.io/langgraph/cloud/
2. **Review deployment logs** in LangGraph dashboard
3. **Test health endpoints** to isolate which backend has issues
4. **Check backend logs** for error messages
5. **Verify environment variables** are set correctly
6. **Contact LangGraph support** (if you have a support plan)
7. **GitHub Issues**: https://github.com/schoolofai/ScottishAILessons/issues

---

## 📚 Additional Resources

- [LangGraph Platform Documentation](https://langchain-ai.github.io/langgraph/cloud/)
- [LangGraph CLI Reference](https://langchain-ai.github.io/langgraph/cloud/reference/cli/)
- [LangGraph Deployment Guide](https://langchain-ai.github.io/langgraph/cloud/deployment/setup/)
- [Appwrite Documentation](https://appwrite.io/docs)
- [Frontend Deployment Guide](./assistant-ui-frontend/REPLIT_DEPLOYMENT.md)

---

**Last Updated**: 2025-01-14
**Version**: 2.0.0 (Dual-Backend Architecture)
**Deployment Target**: LangGraph Platform
