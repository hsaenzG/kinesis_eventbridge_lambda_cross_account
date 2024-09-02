const { Stack,Duration,Tags,RemovalPolicy, CfnParameter} = require('aws-cdk-lib');
const{ CfnSchedule, CfnScheduleGroup } = require('aws-cdk-lib/aws-scheduler');
const { LambdaFunction } = require('aws-cdk-lib/aws-events-targets');
const { Function, Runtime, Code } = require('aws-cdk-lib/aws-lambda');
const { Stream } = require('aws-cdk-lib/aws-kinesis');
const { Effect,Policy, PolicyStatement,Role,ServicePrincipal } = require('aws-cdk-lib/aws-iam');
const { Construct } = require('constructs');
const pipes  = require( 'aws-cdk-lib/aws-pipes');


class CdkEventbridgeKinesisLambdaStack extends Stack {
  
  constructor(scope, id, props) {
    super(scope, id, props);

    // Kinesis Stream
    const kinesisStream = new Stream(this, 'MyKinesisStream', {
      shardCount: 1
    });

    // Lambda that consumes from Kinesis
    const kinesisHandler = new Function(this, 'KinesisHandler', {
      runtime: Runtime.PYTHON_3_8,
      handler: 'kinesis_handler.lambda_handler',
      code: Code.fromAsset('lib/lambda'),
      environment: {
        STREAM_NAME: kinesisStream.streamName,
      },
    });

    // Otorga permisos a la Lambda para escribir en el Kinesis Stream
    kinesisHandler.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['kinesis:PutRecord'],
      resources: [kinesisStream.streamArn],
    }));

    // Forzar eliminación del Kinesis Stream al eliminar el stack
    kinesisStream.applyRemovalPolicy(RemovalPolicy.DESTROY);


    // Create an IAM Role for cross-account invocation
    const crossAccountInvokeRole = new Role(this, 'CrossAccountInvokeRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: 'CrossAccountInvokeRole',
    });

    // Parameters
    const destinationRoleArn = new CfnParameter(this, 'DestinationRoleArn', {
      type: 'String',
      default: 'arn:aws:iam::346914566973:role/destination-lambda-iam-role',
    });

    // IAM Role for the Source Lambda function
    const sourceIAMRole = new Role(this, 'SourceIAMRole', {
      roleName: 'source-lambda-iam-role',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'), // Allow Lambda service to assume this role
    });

    // Attach Policy to IAM Role
    sourceIAMRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole',
                  'logs:CreateLogGroup',                  // Permite crear grupos de logs
                  'logs:CreateLogStream',                 // Permite crear flujos de logs
                  'logs:PutLogEvents',
                  'lambda:InvokeFunction' 
                ],               
        resources: [destinationRoleArn.valueAsString,
                    "arn:aws:logs:*:*:*" 
      ]})
    );

    crossAccountInvokeRole.addToPolicy(new PolicyStatement({
      actions: [
       // 'lambda:InvokeFunction',                // Permite invocar la Lambda en otra cuenta
        'logs:CreateLogGroup',                  // Permite crear grupos de logs
        'logs:CreateLogStream',                 // Permite crear flujos de logs
        'logs:PutLogEvents'                     // Permite enviar eventos de logs a CloudWatch
      ],
      resources: [
        "arn:aws:lambda:us-east-1:346914566973:function:CdkLambdaOriginAccountStack-destinationDB878FB5-BGGIGEd0EJia",
        "arn:aws:logs:*:*:*"                    // Permite acceso a todos los recursos de logs en CloudWatch (ajusta según sea necesario),
        
      ],
    }));


    // call Lambda in another AWS account
    const anotherAccountLambda = new Function(this, 'AnotherAccountLambda', {
      runtime: Runtime.PYTHON_3_8,
      handler: 'another_account_lambda.lambda_handler',
      code: Code.fromAsset('lib/lambda'),
      role: sourceIAMRole,//crossAccountInvokeRole, 
    });

   

    kinesisStream.grantWrite(kinesisHandler);
    // need to create role and policy for scheduler to invoke the lambda function
    const schedulerRole = new Role(this, 'scheduler-role-kinesis', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
      });
    
      new Policy(this, 'schedule-policy-kinesis', {
        policyName: 'ScheduleToInvokeLambdas',
        roles: [schedulerRole],
        statements: [
          new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [kinesisHandler.functionArn],
          }),
        ],
      });

      


    // Create a group for the schedule (maybe you want to add more scheudles to this group the future?)
	  const group = new CfnScheduleGroup(this, 'schedule-group', {
      name: 'SchedulesForLambda',
      });

    // EventBridge rule to trigger Lambda
    const eventRule = new CfnSchedule(this, 'MyScheduledRule', {
        groupName: group.name,
        flexibleTimeWindow: {
          mode: 'OFF',
        },
        scheduleExpression: 'rate(5 minute)',
        target: {
          arn: kinesisHandler.functionArn,
          roleArn: schedulerRole.roleArn,
        },
    });


    
    // Role to allow Kinesis to invoke the Lambda in another account
     const kinesisInvokeRole = new Role(this, 'KinesisInvokeRole', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com'), // Update the trust policy to allow EventBridge Pipes
    });

    
    kinesisStream.grantRead(kinesisInvokeRole);
    anotherAccountLambda.grantInvoke(kinesisInvokeRole);


    const kinesisToLambdaPipe =new pipes.CfnPipe(this, 'KinesisToLambdaPipe', {
      roleArn: kinesisInvokeRole.roleArn,
      source: kinesisStream.streamArn,
      target: anotherAccountLambda.functionArn,
      sourceParameters: {
        kinesisStreamParameters: {
          startingPosition: 'TRIM_HORIZON',
        },
      },

      targetParameters: {
        inputTemplate: '{ "detail-type": "Kinesis Stream Record", "source": "aws.kinesis", "data": <$.data> }',
      },
    });
   Tags.of(kinesisToLambdaPipe).add('Name', 'hsaenz-POC');

  }
}


module.exports = { CdkEventbridgeKinesisLambdaStack }
