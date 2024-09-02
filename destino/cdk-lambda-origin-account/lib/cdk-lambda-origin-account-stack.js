const { Stack, Duration, CfnOutput, CfnParameter, Aws} = require('aws-cdk-lib');
const { Function, Runtime, Code} = require('aws-cdk-lib/aws-lambda');
const { Role, ServicePrincipal, Effect, PolicyStatement, AccountPrincipal,ManagedPolicy } = require('aws-cdk-lib/aws-iam');

class CdkLambdaOriginAccountStack extends Stack {

  constructor(scope, id, props) {
    super(scope, id, props);


     // Parameter
     const callingAccountId = new CfnParameter(this, 'CallingAccountId', {
      type: 'String',
      default: '640609193265',
    });

    // Define the IAM Role with the correct trust relationship
    const lambdaExecutionRole = new Role(this, 'LambdaExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'), // Allow Lambda service to assume this role
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

     // Lambda in another AWS account
     const anotherAccountLambda = new Function(this, 'destination', {
      runtime: Runtime.PYTHON_3_8,
      handler: 'destination_handler.lambda_handler',
      code: Code.fromAsset('lib/lambda'),
      role: lambdaExecutionRole,
    });


    // IAM Role
    const destinationIAMRole = new Role(this, 'DestinationIAMRole', {
      roleName: 'destination-lambda-iam-role',
      assumedBy: new AccountPrincipal(callingAccountId.valueAsString),
    });

    // Attach Policy to IAM Role
    destinationIAMRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [anotherAccountLambda.functionArn],
      })
    );

   // Output del ARN de la Lambda para la otra cuenta
   new CfnOutput(this, 'LambdaArn', {
     value: anotherAccountLambda.functionArn,
     description: 'ARN of the Lambda function to share with the other account',
   });


  

}}

module.exports = { CdkLambdaOriginAccountStack }
