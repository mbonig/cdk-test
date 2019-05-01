import {expect, haveResource} from '@aws-cdk/assert';
import {CICDStack, Options} from "../lib/cicdStack";
import {Stack} from "@aws-cdk/cdk";
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
            githubBranch: 'somebranch',
            githubOwner: 'mbonig',
            githubRepo: 'somerepo',
            codebuildBuildspec: 'buildspec.yml'
        };
    });

    it('Should create cloudfront', () => {
        myStack.create({...options, useCloudFront: true});
        expect(myStack).to(haveResource("AWS::CloudFront::Distribution"));
    });

    it('Should not create cloudfront', () => {
        myStack.create(options);
        expect(myStack).notTo(haveResource("AWS::CloudFront::Distribution"));
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
    });
});