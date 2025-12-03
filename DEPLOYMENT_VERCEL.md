# Vercel Deployment - Final Configuration

## What We Fixed

The `ModuleNotFoundError: No module named 'app'` error was caused by Vercel's serverless functions being isolated - they can't import from other files in the same directory.

## Solution: Single-File Serverless Function

We consolidated everything into a single `api/index.py` file that contains:
1. All the FastAPI application code
2. All endpoints and helper functions
3. The Mangum handler that Vercel expects

## Current Structure

```
fx-accumulator/
├── api/                    # Vercel serverless functions
│   ├── index.py           # Complete FastAPI app + Mangum handler (SINGLE FILE)
│   └── requirements.txt   # Python dependencies
├── backend/               # Original backend (kept for local development)
│   ├── main.py
│   └── requirements.txt
├── frontend/              # React application
│   └── ...
└── vercel.json           # Vercel configuration
```

## How It Works

**`api/index.py`** contains:
- Complete FastAPI application with all imports
- All data models (Pydantic)
- All helper functions (`get_schedule`, `monte_carlo_pricer`)
- All endpoints (`/solve`, `/simulate`, `/structure`, `/valuation`, `/spot`)
- **Mangum handler** at the bottom:
  ```python
  from mangum import Mangum
  handler = Mangum(app, lifespan="off")
  ```

**`vercel.json`** routes all API requests to this single function.

## Key Points

✅ **Single file**: All code in one file (Vercel requirement for imports)  
✅ **Variable name**: Handler is named `handler` (Vercel requirement)  
✅ **Location**: File is `api/index.py` (Vercel convention)  
✅ **Mangum adapter**: Converts FastAPI (ASGI) to Vercel's serverless format  

## Deploy

**Push to GitHub:**
```bash
git add .
git commit -m "Consolidate backend into single api/index.py for Vercel"
git push
```

Vercel will automatically:
- Detect `api/index.py`
- Install dependencies from `api/requirements.txt`
- Create serverless function with `handler`
- Route requests per `vercel.json`

## Testing After Deploy

Once deployed, test your endpoints:
```bash
# Replace with your actual Vercel URL
curl https://your-app.vercel.app/spot?ticker=EURUSD=X
```

Frontend will automatically connect via the `VITE_API_URL=/` environment variable.

## Important Warnings

### ⚠️ Function Size Limit
Your backend uses heavy libraries:
- `pandas` (~50MB)
- `numpy` (~30MB)  
- `yfinance` + dependencies (~20MB)

**Vercel Limits:**
- Free tier: 50MB
- Pro tier: 250MB

**If deployment fails with "Function too large":**
1. Upgrade to Vercel Pro
2. **OR** Use Google Cloud Run instead (see `DEPLOYMENT_GCP.md`) - no size limits

### ⚠️ Execution Time Limit
- Free tier: 10 seconds
- Pro tier: 60 seconds

Monte Carlo simulations might timeout. Consider reducing `num_sims` in production.

### ⚠️ yfinance Rate Limits
Yahoo Finance may rate-limit Vercel's shared IPs. For production, use a paid data provider (Alpha Vantage, IEX Cloud, etc.).

## Alternative: Google Cloud Run

If you hit Vercel's limits, Google Cloud Run is a better option:
- No function size limits
- No execution time limits (up to 60 minutes)
- Better for compute-heavy workloads
- See `DEPLOYMENT_GCP.md` for instructions
