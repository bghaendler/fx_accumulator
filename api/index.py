from mangum import Mangum
from app import app

# Vercel serverless handler
handler = Mangum(app, lifespan="off")
