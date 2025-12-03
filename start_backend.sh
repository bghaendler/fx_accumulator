#!/bin/bash
# Kill any process running on port 8000
lsof -ti :8000 | xargs kill -9 2>/dev/null

# Start the backend
cd backend
/Users/borjagarcia/opt/anaconda3/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
