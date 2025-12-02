import sys
import json
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from main import app
from mangum import Mangum

# Wrap FastAPI app with Mangum for serverless
handler = Mangum(app, lifespan="off")

def handler_wrapper(event, context):
    """Netlify Function handler"""
    return handler(event, context)
