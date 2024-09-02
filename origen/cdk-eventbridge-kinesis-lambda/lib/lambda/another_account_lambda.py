import boto3
import json
import base64

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))  # Log the entire event for debugging
    
    try:
         
            

        # Configurar el cliente de Lambda
        sts = boto3.client('sts', region_name='us-east-1')

        sts_params = {
            'RoleArn': 'arn:aws:iam::346914566973:role/destination-lambda-iam-role',
            'DurationSeconds': 3600,
            'RoleSessionName': 'cross-account-lambda-session'
    }
    


        # Configurar los parámetros de la invocación
        #params = {
        #    'FunctionName': 'us-east-1:346914566973:function:CdkLambdaOriginAccountStack-destinationDB878FB5-BGGIGEd0EJia',
        #    'InvocationType': 'RequestResponse',  # 'Event' para invocación asíncrona
        #    'Payload': json.dumps(event)  # Los datos que quieres pasar a la Lambda de destino
        #}

        sts_results = sts.assume_role(**sts_params)
        lambda_client = boto3.client(
            'lambda', 
            region_name='us-east-1',
            aws_access_key_id=sts_results['Credentials']['AccessKeyId'],
            aws_secret_access_key=sts_results['Credentials']['SecretAccessKey'],
            aws_session_token=sts_results['Credentials']['SessionToken'])

        params = {
            'FunctionName': 'us-east-1:346914566973:function:CdkLambdaOriginAccountStack-destinationDB878FB5-BGGIGEd0EJia',
            'InvocationType': 'RequestResponse',  # 'Event' para invocación asíncrona
            'Payload': json.dumps(event)  # Los datos que quieres pasar a la Lambda de destino
        }

        # Invocar la Lambda en la otra cuenta
        response = lambda_client.invoke(**params)

        # Leer la respuesta si es necesario
        response_payload = json.loads(response['Payload'].read())
        print('Lambda invocada exitosamente:', response_payload)
        
    except KeyError as ke:
        print(f"KeyError: Missing key in record: {ke}")
    except Exception as e:
        print('Error invocando la Lambda:', e)
        raise e

    return {"statusCode": 200, "body": "Processing complete"}
