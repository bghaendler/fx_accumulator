# Deploying to Vercel

To deploy this full-stack application (React + Python FastAPI) to Vercel, follow these steps.

## 1. Project Structure

The project is now configured with:
-   `frontend/`: React + Vite application
-   `backend/`: FastAPI application (main logic)
-   `api/`: Vercel serverless functions (wrapper that imports from `backend/`)

Vercel requires Python serverless functions to be in the `api/` folder. The `api/index.py` file imports your FastAPI app from `backend/main.py`.

## 2. Vercel Dashboard Settings

Go to your Vercel Project Settings and configure:

### Build & Development Settings
-   **Framework Preset**: Select **Vite**.
-   **Root Directory**: Leave this **EMPTY**.
-   **Build Command**: Override and set to:
    ```bash
    cd frontend && npm install && npm run build
    ```
-   **Output Directory**: Override and set to:
    ```bash
    frontend/dist
    ```

### Environment Variables
Add the following environment variable:
-   **Key**: `VITE_API_URL`
-   **Value**: `/` (just a forward slash)

This tells the frontend to make API calls to the same domain, which Vercel will route to your Python functions.

## 3. Deploy
-   Push your changes to GitHub.
-   Vercel will automatically trigger a deployment.
-   The `vercel.json` configuration handles routing API requests to `/api/index` (your Python backend).

## 4. Important Notes

### Function Size Limits
Vercel's free tier has a 250MB limit for serverless functions. Your backend uses heavy libraries (`pandas`, `numpy`, `yfinance`). If deployment fails due to size:
1.  **Upgrade to Vercel Pro** (50MB → 250MB limit increase)
2.  **Or switch to Google Cloud Run** (see `DEPLOYMENT_GCP.md`) which has no such limits

### Python Version
The backend uses Python 3.9 (specified in `runtime.txt`). Vercel will automatically use this version.

