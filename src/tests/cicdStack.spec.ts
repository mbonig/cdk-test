import {expect, haveResource} from '@aws-cdk/assert';
import {CICDStack, Options} from "../lib/cicdStack";
import {Stack} from "@aws-cdk/cdk";
import {Bucket} from "@aws-cdk/aws-s3";
import {Pipeline} from "@aws-cdk/aws-codepipeline";
import cdk = require('@aws-cdk/cdk');

const should = require('should');

describe("CICD Stack", () => {
    let mockApp: Stack;
    let myStack: CICDStack;
    let options: Options;

    beforeEach(() => {
        mockApp = new cdk.Stack();
        myStack = new CICDStack(mockApp, 'TestingStack');
        options = {
            prefix: 'unittest',
            useCloudFront: false,
            useS3Hosting: false,
            indexDocument: undefined,
            errorDocument: undefined,
            githubBranch: 'somebranch',
            githubOwner: 'mbonig',
            githubRepo: 'somerepo',
            codebuildBuildspec: 'buildspec.yml'
        };
    });

    describe('Cloudfront options', ()=>{
        it('Should create cloudfront', () => {
            myStack.create({...options, useCloudFront: true});
            expect(myStack).to(haveResource("AWS::CloudFront::Distribution"));
        });

        it('Should not create cloudfront', () => {
            myStack.create(options);
            expect(myStack).notTo(haveResource("AWS::CloudFront::Distribution"));
        });
    }).timeout(5000);

    describe('S3 hosting option', ()=>{
        it('Should create hosting, uses index if not provided', () => {
            myStack.create({...options, useS3Hosting: true});
            let bucket: any = myStack.node.children.find(c => c instanceof Bucket);
            should(bucket.node.children[0].properties.websiteConfiguration).not.be.undefined();
            should(bucket.node.children[0].properties.websiteConfiguration.indexDocument).be.equal('index.html');
        });

        it('Should create hosting, uses provided', () => {
            myStack.create({...options, useS3Hosting: true, indexDocument: 'notindex.html'});
            let bucket: any = myStack.node.children.find(c => c instanceof Bucket);
            should(bucket.node.children[0].properties.websiteConfiguration).not.be.undefined();
            should(bucket.node.children[0].properties.websiteConfiguration.indexDocument).be.equal('notindex.html');
        });

        it('Should not create s3 hosting', () => {
            myStack.create(options);
            let bucket: any = myStack.node.children.find(c => c instanceof Bucket);
            should(bucket.node.children[0].properties.websiteConfiguration).be.undefined();
        });
    });

    describe('CodePipeline', () => {
        it('Source action should be github with creds', () => {
            myStack.create(options);
            expect(myStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myStack.node.children.find(c => c instanceof Pipeline);
            let sourceStage = pipeline.stages.find((s: any) => s.stageName === 'Source');

            should(sourceStage.actions[0].configuration.Owner).be.equal(options.githubOwner);
            should(sourceStage.actions[0].configuration.Repo).be.equal(options.githubRepo);
            should(sourceStage.actions[0].configuration.Branch).be.equal(options.githubBranch);
            should(sourceStage.actions[0].configuration.OAuthToken).match(/^\$\{Token\[TOKEN\.[0-9]+\]\}$/);
        });

        it('defaults to master branch', () => {

            let o = {...options};
            delete o.githubBranch;
            myStack.create(o);

            expect(myStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myStack.node.children.find(c => c instanceof Pipeline);
            let sourceStage = pipeline.stages.find((s: any) => s.stageName === 'Source');

            should(sourceStage.actions[0].configuration.Branch).be.equal('master');

        });

        it('uses passthrough buildspec when empty', () => {
            let o = {...options};
            delete o.codebuildBuildspec;
            myStack.create(o);

            expect(myStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(JSON.stringify(CICDStack.PASSTHROUGH_BUILDSPEC, null, 2));

        });

        it('uses given buildspec', () => {
            let o = {...options, codebuildBuildspec: 'buildspec.prod.yml'};

            myStack.create(o);

            expect(myStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(o.codebuildBuildspec);

        });

        it ('uses buildspec as object', ()=>{
            let o = {...options, codebuildBuildspec: {}};

            myStack.create(o);

            expect(myStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(JSON.stringify(o.codebuildBuildspec));
        });
    });
});