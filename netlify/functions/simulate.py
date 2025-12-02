import sys
import os
import json

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
sys.path.insert(0, backend_path)

from main import simulate_structure, SimulationRequest

def handler(event, context):
    """Netlify Function for /simulate endpoint"""
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Create request object
        req = SimulationRequest(**body)
        
        # Call the backend function
        import asyncio
        result = asyncio.run(simulate_structure(req))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
