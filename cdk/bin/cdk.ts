#!/usr/bin/env node
import { App, type Environment } from 'aws-cdk-lib';
import { CertificateStack, ReadingAssistStack } from '../lib/reading-assist-stack.js';

const app = new App();

const domainName = app.node.tryGetContext('domain');
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

// Main region from environment (set by deploy script via .env)
const mainRegion = process.env.CDK_DEFAULT_REGION
  || process.env.AWS_REGION
  || 'us-east-1';

// Certificate stack always deploys to us-east-1 (required by CloudFront)
let certificate, zone;
if (domainName && hostedZoneId) {
  const certStack = new CertificateStack(app, 'ReadingAssistCertStack', {
    env: { region: 'us-east-1' },
    domainName,
    hostedZoneId,
    description: 'ACM certificate for Reading Assist (us-east-1)',
  });
  certificate = certStack.certificate;
  zone = certStack.zone;
}

new ReadingAssistStack(app, 'ReadingAssistStack', {
  env: { region: mainRegion },
  domainName,
  hostedZoneId,
  certificate,
  zone,

  // The directory containing the built frontend files (output of `npm run build`)
  frontendBuildDir: '../../dist',

  description: 'Reading Assist – translation & dictionary webapp (S3 + CloudFront)',
});
