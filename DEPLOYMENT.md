# FX Accumulator - Deployment Guide

## Overview
This application consists of:
- **Frontend**: React + Vite (deployed to Netlify)
- **Backend**: Python FastAPI (deployed as Netlify Functions)

## Architecture

### Production (Netlify)
- Frontend is built from `frontend/` directory
- Backend endpoints are deployed as individual Netlify Functions in `netlify/functions/`
- API calls use relative path `/.netlify/functions/[endpoint]`

### Local Development
- Frontend runs on `http://localhost:5173` (Vite dev server)
- Backend runs on `http://localhost:8000` (FastAPI/Uvicorn)
- API calls use `http://localhost:8000/[endpoint]`

## Local Development Setup

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend will start on `http://localhost:8000`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`

## Environment Variables

The application uses a unified API URL structure for both development and production:

- **`.env.development`**: `VITE_API_URL=/.netlify/functions`
  - Vite proxies these requests to `http://localhost:8000`
  
- **`.env.production`**: `VITE_API_URL=/.netlify/functions`
  - Netlify routes these to serverless functions

This ensures consistent behavior across environments.

## Netlify Deployment

### Automatic Deployment
1. Push changes to your Git repository
2. Netlify will automatically:
   - Build the frontend from `frontend/` directory
   - Deploy Python serverless functions from `netlify/functions/`
   - Set up the correct API routing

### Manual Deployment
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

## API Endpoints

All endpoints are available at:
- **Local**: `http://localhost:8000/[endpoint]`
- **Production**: `https://your-site.netlify.app/.netlify/functions/[endpoint]`

### Available Endpoints
- `POST /simulate` - Run historical backtest simulation
- `POST /structure` - Get structure details and fixing schedule
- `POST /valuation` - Calculate Greeks and valuation
- `POST /solve` - Solve for zero-cost parameters

## Troubleshooting

### Backend not working locally
- Ensure Python dependencies are installed: `pip install -r backend/requirements.txt`
- Check that the backend is running on port 8000
- Verify no other service is using port 8000

### Frontend not connecting to backend
- Check the console for CORS errors
- Verify the `VITE_API_URL` environment variable is set correctly
- In development, ensure both frontend and backend are running

### Netlify Functions timeout
- Netlify Functions have a 10-second timeout on the free tier
- For compute-intensive operations (Monte Carlo simulations), consider:
  - Reducing `num_sims` in the backend
  - Upgrading to Netlify Pro for 26-second timeout
  - Using an external backend service

## Configuration Files

- **`netlify.toml`**: Netlify build and deployment configuration
- **`runtime.txt`**: Python version specification for Netlify
- **`netlify/functions/requirements.txt`**: Python dependencies for serverless functions
- **`frontend/.env.development`**: Development environment variables
- **`frontend/.env.production`**: Production environment variables

## Tech Stack

### Frontend
- React 19
- Vite
- Recharts (data visualization)
- Axios (HTTP client)
- Lucide React (icons)

### Backend
- FastAPI
- yfinance (market data)
- pandas (data processing)
- numpy (numerical computations)
- pydantic (data validation)
