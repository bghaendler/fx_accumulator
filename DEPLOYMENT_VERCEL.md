# Vercel Deployment - Final Configuration

## What We Fixed

The `TypeError: issubclass() arg 1 must be a class` error was caused by Vercel not being able to properly find and load the handler.

## Current Structure

```
fx-accumulator/
├── api/                    # Vercel serverless functions (REQUIRED location)
│   ├── app.py             # FastAPI application (copied from backend/main.py)
│   ├── index.py           # Vercel handler (imports app and wraps with Mangum)
│   └── requirements.txt   # Python dependencies
├── backend/               # Original backend (kept for local development)
│   ├── main.py
│   └── requirements.txt
├── frontend/              # React application
│   └── ...
└── vercel.json           # Vercel configuration
```

## How It Works

1. **`api/app.py`**: Contains your complete FastAPI application with all endpoints (`/solve`, `/simulate`, etc.)
2. **`api/index.py`**: 
   - Imports the FastAPI `app` from `app.py`
   - Wraps it with `Mangum` (ASGI to AWS Lambda/Vercel adapter)
   - Exports `handler` variable that Vercel expects
3. **`vercel.json`**: Routes API requests to `/api/index`

## Key Points

✅ **Variable name**: The handler is named `handler` (Vercel requirement)  
✅ **Location**: Files are in `api/` folder (Vercel requirement)  
✅ **Same directory import**: `from app import app` works because both files are in `api/`  
✅ **Mangum adapter**: Converts FastAPI (ASGI) to Vercel's serverless format  

## Deploy

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Fix Vercel backend configuration"
   git push
   ```

2. **Vercel will automatically**:
   - Detect `api/index.py`
   - Install dependencies from `api/requirements.txt`
   - Create serverless function with `handler`
   - Route requests per `vercel.json`

## Testing After Deploy

Once deployed, test your endpoints:
- `https://your-app.vercel.app/solve`
- `https://your-app.vercel.app/simulate`
- `https://your-app.vercel.app/spot?ticker=EURUSD=X`

## Important Notes

⚠️ **Function Size**: Your backend uses heavy libraries (pandas, numpy, yfinance). If deployment fails with "Function too large":
- Upgrade to Vercel Pro (250MB limit)
- OR use Google Cloud Run instead (see `DEPLOYMENT_GCP.md`)

⚠️ **yfinance Rate Limits**: Yahoo Finance may rate-limit Vercel's shared IPs. Consider using a paid data provider for production.
