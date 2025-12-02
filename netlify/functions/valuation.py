import sys
import os
import json

backend_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
sys.path.insert(0, backend_path)

from main import calculate_valuation, ValuationRequest

def handler(event, context):
    """Netlify Function for /valuation endpoint"""
    try:
        body = json.loads(event.get('body', '{}'))
        req = ValuationRequest(**body)
        
        import asyncio
        result = asyncio.run(calculate_valuation(req))
        
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
