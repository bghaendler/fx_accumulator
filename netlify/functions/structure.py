import sys
import os
import json

backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
sys.path.insert(0, backend_path)

from main import get_structure_details, SimulationRequest

def handler(event, context):
    """Netlify Function for /structure endpoint"""
    try:
        body = json.loads(event.get('body', '{}'))
        req = SimulationRequest(**body)
        
        import asyncio
        result = asyncio.run(get_structure_details(req))
        
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
