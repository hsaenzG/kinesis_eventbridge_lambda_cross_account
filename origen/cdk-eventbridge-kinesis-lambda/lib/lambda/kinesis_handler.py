import json
import boto3
from datetime import datetime
import os

kinesis_client = boto3.client('kinesis')

def lambda_handler(event, context):
    stream_name =  os.environ['STREAM_NAME']  # Reemplaza con el nombre de tu Kinesis Stream
    
    # Crear el mensaje con "Hola Mundo" y la fecha/hora actual
    data = {
        "message": "Hola Mundo",
        "timestamp": datetime.utcnow().isoformat() + "Z"  # Fecha y hora en formato ISO 8601 (UTC)
    }
    
    # Convierte los datos a un string JSON y luego a bytes
    data_bytes = json.dumps(data).encode('utf-8')
    
    # Envía el registro al Kinesis Stream
    response = kinesis_client.put_record(
        StreamName=stream_name,
        Data=data_bytes,
        PartitionKey="holaMundoPartitionKey"  # La clave de partición puede ser cualquier string
    )
    
    print(f"Record sent to Kinesis Stream. Response: {response}")
    
    return {
        'statusCode': 200,
        'body': json.dumps('Data sent to Kinesis Stream successfully')
    }
