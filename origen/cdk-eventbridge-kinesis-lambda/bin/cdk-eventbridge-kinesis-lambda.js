#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { CdkEventbridgeKinesisLambdaStack } = require('../lib/cdk-eventbridge-kinesis-lambda-stack');

const app = new cdk.App();
new CdkEventbridgeKinesisLambdaStack(app, 'CdkEventbridgeKinesisLambdaStack');
