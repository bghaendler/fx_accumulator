# Deploying to Google Cloud Platform (Cloud Run / Vertex AI)

While you asked about **Vertex AI**, this application is a full-stack web app (React Frontend + FastAPI Backend). 
- **Vertex AI** is typically used for training and serving Machine Learning models (e.g., TensorFlow, PyTorch).
- **Cloud Run** is the standard Google Cloud service for hosting containerized applications like this one. It is serverless, scalable, and cost-effective.

If your goal is to host this application on Google Cloud, **Cloud Run** is the correct choice.

## Prerequisites

1.  **Google Cloud Project**: Create one at [console.cloud.google.com](https://console.cloud.google.com).
2.  **gcloud CLI**: Install and authenticate (`gcloud auth login`).
3.  **Enable APIs**:
    ```bash
    gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com
    ```

## 1. Deploying the Backend (FastAPI)

We will deploy the backend as a container on Cloud Run.

1.  **Navigate to backend**:
    ```bash
    cd backend
    ```

2.  **Build and Submit Container**:
    Replace `PROJECT_ID` with your actual GCP project ID.
    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/fx-backend
    ```

3.  **Deploy to Cloud Run**:
    ```bash
    gcloud run deploy fx-backend \
      --image gcr.io/PROJECT_ID/fx-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated
    ```

4.  **Get the URL**:
    The command will output a Service URL (e.g., `https://fx-backend-xyz-uc.a.run.app`). 
    **Copy this URL.** You will need it for the frontend.

## 2. Deploying the Frontend (React)

1.  **Navigate to frontend**:
    ```bash
    cd ../frontend
    ```

2.  **Update Environment Variables**:
    Create a `.env.production` file (or edit the existing one) to point to your new Backend URL.
    ```bash
    # frontend/.env.production
    VITE_API_URL=https://fx-backend-xyz-uc.a.run.app
    ```
    *(Make sure to remove any trailing slash if your code appends endpoints)*

3.  **Build and Submit Container**:
    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/fx-frontend
    ```

4.  **Deploy to Cloud Run**:
    ```bash
    gcloud run deploy fx-frontend \
      --image gcr.io/PROJECT_ID/fx-frontend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated
    ```

5.  **Access your App**:
    Click the URL provided by the frontend deployment (e.g., `https://fx-frontend-xyz-uc.a.run.app`).

## Alternative: Vertex AI (If specifically required)

If you strictly need to use **Vertex AI Prediction** (e.g., to manage the Monte Carlo simulation as a "Model" version), you would only deploy the backend logic there.

1.  **Modify `main.py`**: Vertex AI expects specific health and prediction routes (`/health`, `/predict`). You would need to map your `/solve` or `/simulate` endpoints to these.
2.  **Upload Model**:
    ```bash
    gcloud ai models upload \
      --container-image-uri=gcr.io/PROJECT_ID/fx-backend \
      --display-name=fx-accumulator-model
    ```
3.  **Deploy Endpoint**:
    Create an endpoint and deploy the model to it.

**Recommendation**: Stick to **Cloud Run** for this application type. It is easier to manage, supports all your endpoints (`/simulate`, `/structure`, etc.) natively without rewriting routes, and is cheaper for general web traffic.

## Troubleshooting

### yfinance Rate Limits
The `yfinance` library downloads data from Yahoo Finance. In a cloud environment (like Cloud Run), shared IP addresses might be rate-limited by Yahoo.
- **Symptom**: The `/simulate` or `/spot` endpoints return 404 or 500 errors.
- **Solution**:
    - Use a paid market data provider API (e.g., Alpha Vantage, IEX Cloud) instead of `yfinance` for production.
    - Or, implement caching (e.g., Redis) to reduce calls to Yahoo Finance.

