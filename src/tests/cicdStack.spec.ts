import {expect, haveResource} from '@aws-cdk/assert';
import {CICDStack, Options} from "../lib/cicdStack";
import {Stack} from "@aws-cdk/cdk";
import {Bucket} from "@aws-cdk/aws-s3";
import {Pipeline} from "@aws-cdk/aws-codepipeline";
import cdk = require('@aws-cdk/cdk');
import should = require('should');


describe("CICD Stack", () => {
    let mockApp: Stack;
    let myCICDStack: CICDStack;
    let options: Options;

    beforeEach(() => {
        mockApp = new cdk.Stack();
        myCICDStack = new CICDStack(mockApp, 'TestingStack');
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

    describe('CodePipeline', () => {
        it('Source action should be github with creds', () => {
            myCICDStack.create(options);
            expect(myCICDStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myCICDStack.node.children.find(c => c instanceof Pipeline);
            let sourceStage = pipeline.stages.find((s: any) => s.stageName === 'Source');

            let sourceActionConfiguration = sourceStage.actions[0].configuration;
            should(sourceActionConfiguration.Owner).be.equal(options.githubOwner);
            should(sourceActionConfiguration.Repo).be.equal(options.githubRepo);
            should(sourceActionConfiguration.Branch).be.equal(options.githubBranch);
            should(sourceActionConfiguration.OAuthToken).match(/^\$\{Token\[TOKEN\.[0-9]+\]\}$/);
        });

        it('defaults to master branch', () => {

            let o = {...options};
            delete o.githubBranch;
            myCICDStack.create(o);

            expect(myCICDStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myCICDStack.node.children.find(c => c instanceof Pipeline);
            let sourceStage = pipeline.stages.find((s: any) => s.stageName === 'Source');

            should(sourceStage.actions[0].configuration.Branch).be.equal('master');

        });

        it('uses passthrough buildspec when empty', () => {
            let o = {...options};
            delete o.codebuildBuildspec;
            myCICDStack.create(o);

            expect(myCICDStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myCICDStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(JSON.stringify(CICDStack.PASSTHROUGH_BUILDSPEC, null, 2));

        });

        it('uses given buildspec', () => {
            let o = {...options, codebuildBuildspec: 'buildspec.prod.yml'};

            myCICDStack.create(o);

            expect(myCICDStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myCICDStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(o.codebuildBuildspec);

        });

        it('uses buildspec as object', () => {
            let o = {...options, codebuildBuildspec: {test: 'some_test_value'}};

            myCICDStack.create(o);

            expect(myCICDStack).to(haveResource("AWS::CodePipeline::Pipeline"));
            let pipeline: any = myCICDStack.node.children.find(c => c instanceof Pipeline);
            let buildStage = pipeline.stages.find((s: any) => s.stageName === 'Build');

            let buildSpec = buildStage.actions[0].props.project.node.children[1].properties.source.buildSpec;
            should(buildSpec).be.equal(JSON.stringify(o.codebuildBuildspec));
        });
    });

    describe('Cloudfront options', () => {
        it('Should create cloudfront', () => {
            myCICDStack.create({...options, useCloudFront: true});
            expect(myCICDStack).to(haveResource("AWS::CloudFront::Distribution"));
        });

        it('Should not create cloudfront', () => {
            myCICDStack.create(options);
            expect(myCICDStack).notTo(haveResource("AWS::CloudFront::Distribution"));
        });
    }).timeout(5000);

    describe('S3 hosting option', () => {
        it('Should create hosting, uses index if not provided', () => {
            myCICDStack.create({...options, useS3Hosting: true});
            let bucket: any = myCICDStack.node.children.find(c => c instanceof Bucket);
            let websiteConfiguration = bucket.node.children[0].properties.websiteConfiguration;

            should(websiteConfiguration).be.ok();
            should(websiteConfiguration.indexDocument).be.equal('index.html');
        });

        it('Should create hosting, uses provided', () => {
            myCICDStack.create({...options, useS3Hosting: true, indexDocument: 'notindex.html'});
            let bucket: any = myCICDStack.node.children.find(c => c instanceof Bucket);
            let websiteConfiguration = bucket.node.children[0].properties.websiteConfiguration;

            should(websiteConfiguration).not.be.undefined();
            should(websiteConfiguration.indexDocument).be.equal('notindex.html');
        });

        it('Should not create s3 hosting', () => {
            myCICDStack.create(options);
            let bucket: any = myCICDStack.node.children.find(c => c instanceof Bucket);
            let websiteConfiguration = bucket.node.children[0].properties.websiteConfiguration;
            should(websiteConfiguration).be.undefined();
        });
    });
});