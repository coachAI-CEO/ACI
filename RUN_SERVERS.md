# How to Run the Servers

## Quick Start

You need to run **two servers**:
1. **API Server** (port 4000) - Backend that generates drills
2. **Web Server** (port 3000) - Frontend that displays drills

---

## Prerequisites

1. **Node.js** and **pnpm** installed
2. **Environment variables** set up (see below)
3. **Database** configured (if using persistence)

---

## Step 1: Set Up Environment Variables

### API Server (.env file)

Create `apps/api/.env` with:

```bash
# Gemini API Key (required)
GEMINI_API_KEY=your_api_key_here

# Database (optional - only if using persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/aci

# Optional flags
# BYPASS_QA=1  # Skip QA (for testing)
# USE_LLM_FIXER=1  # Enable LLM fixer
# PERSIST_DRILLS=1  # Save drills to database
```

### Web Server

No environment variables needed (uses default Next.js config).

---

## Step 2: Install Dependencies

From the project root:

```bash
# Install all dependencies (monorepo)
pnpm install
```

Or install individually:

```bash
# API dependencies
cd apps/api
pnpm install

# Web dependencies
cd apps/web
pnpm install
```

---

## Step 3: Run the API Server

**Terminal 1:**

```bash
cd apps/api
pnpm dev
```

The API server will start on **http://localhost:4000**

You should see:
```
ACI API listening on :4000
```

**Note**: Make sure you have `GEMINI_API_KEY` set in your `.env` file!

---

## Step 4: Run the Web Server

**Terminal 2:**

```bash
cd apps/web
pnpm dev
```

The web server will start on **http://localhost:3000**

You should see:
```
  ▲ Next.js 16.0.3
  - Local:        http://localhost:3000
```

---

## Step 5: Open the Drill Page

Open your browser and go to:

**http://localhost:3000/demo/drill**

You should see:
- A form to configure drill generation
- Options for game model, phase, zone, age group, etc.
- A "Generate drill" button

---

## Testing the Setup

### 1. Test API Directly

```bash
curl -X POST http://localhost:4000/coach/generate-drill-vetted \
  -H "Content-Type: application/json" \
  -d '{
    "gameModelId": "POSSESSION",
    "ageGroup": "U10",
    "phase": "ATTACKING",
    "zone": "ATTACKING_THIRD",
    "formationUsed": "2-3-1",
    "playerLevel": "INTERMEDIATE",
    "coachLevel": "GRASSROOTS",
    "numbersMin": 8,
    "numbersMax": 10,
    "goalsAvailable": 2,
    "spaceConstraint": "HALF",
    "durationMin": 20
  }'
```

### 2. Test Web Page

1. Go to http://localhost:3000/demo/drill
2. Fill out the form (or use defaults)
3. Click "Generate drill"
4. You should see:
   - A tactical diagram
   - Drill details (organization, coaching points, etc.)
   - QA scores (if available)

---

## Troubleshooting

### API Server Issues

**Problem**: "GEMINI_API_KEY is not set"
- **Solution**: Create `apps/api/.env` with your Gemini API key

**Problem**: "Port 4000 already in use"
- **Solution**: Kill the process using port 4000:
  ```bash
  lsof -ti:4000 | xargs kill
  ```

**Problem**: "Cannot connect to database"
- **Solution**: Either set up PostgreSQL or remove `DATABASE_URL` (drills won't be saved)

### Web Server Issues

**Problem**: "Port 3000 already in use"
- **Solution**: Kill the process or use a different port:
  ```bash
  PORT=3001 pnpm dev
  ```

**Problem**: "Failed to fetch drill from ACI API"
- **Solution**: Make sure API server is running on port 4000
- Check that API server logs show it's listening

**Problem**: "No diagram found"
- **Solution**: Check API response - might be using old format
- Check browser console for errors

---

## Running Both Servers at Once

### Option 1: Two Terminals (Recommended)

**Terminal 1:**
```bash
cd apps/api && pnpm dev
```

**Terminal 2:**
```bash
cd apps/web && pnpm dev
```

### Option 2: Background Process

**Terminal 1:**
```bash
cd apps/api && pnpm dev > /tmp/api-server.log 2>&1 &
cd apps/web && pnpm dev > /tmp/web-server.log 2>&1 &
```

**Check logs:**
```bash
tail -f /tmp/api-server.log
tail -f /tmp/web-server.log
```

**Stop servers:**
```bash
lsof -ti:4000 | xargs kill
lsof -ti:3000 | xargs kill
```

---

## Development Workflow

1. **Start API server** (Terminal 1)
2. **Start web server** (Terminal 2)
3. **Open browser** to http://localhost:3000/demo/drill
4. **Make changes** to code
5. **Servers auto-reload** (nodemon for API, Next.js hot reload for web)
6. **Refresh browser** to see changes

---

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| API Server | 4000 | http://localhost:4000 |
| Web Server | 3000 | http://localhost:3000 |
| Drill Page | 3000 | http://localhost:3000/demo/drill |

---

## Quick Commands Reference

```bash
# Install dependencies
pnpm install

# Run API server
cd apps/api && pnpm dev

# Run web server
cd apps/web && pnpm dev

# Kill servers
lsof -ti:4000 | xargs kill  # API
lsof -ti:3000 | xargs kill  # Web

# Check if servers are running
curl http://localhost:4000/ai/ping  # API health check
curl http://localhost:3000          # Web server
```

---

## Next Steps

Once both servers are running:

1. **Generate a drill** using the web form
2. **View the diagram** and drill details
3. **Check the organization section** - should show structured fields (setupSteps, area, rotation, etc.)
4. **Try different configurations** to test various drill types

Enjoy! 🎉

