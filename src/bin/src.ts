#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import {CICDStack} from "../lib/cicdStack";

const options = require('../cdk-variables.json');
console.log("Executing Stacks with options: ", options);

const app = new cdk.App();

new CICDStack(app, 'CICDStack').create(options);

