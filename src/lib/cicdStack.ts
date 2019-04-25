import {Construct, Stack, StackProps} from "@aws-cdk/cdk";
import {Bucket, IBucket} from '@aws-cdk/aws-s3';
import {CloudFrontWebDistribution} from "@aws-cdk/aws-cloudfront";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as ssm from "@aws-cdk/aws-ssm";
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');

export class CICDStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
    }

    create(options: Options) {
        const deployBucket = new Bucket(this, `${options.prefix}-cicd-deploy`);
        this.setupCodePipeline(options, deployBucket);

        if (options.useCloudFront) {
            new CloudFrontWebDistribution(this, `${options.prefix}-cf-distribution`, {
                originConfigs: [
                    {
                        s3OriginSource: {
                            s3BucketSource: deployBucket
                        },
                        behaviors: [{isDefaultBehavior: true}]
                    }
                ]
            });
        }
    }

    private setupCodePipeline(options: Options, bucket: IBucket) {
        const o = {
            githubBranch: 'master',
            githubTokenParameterName: 'my-github-token',
            ...options
        };

        const token = new ssm.ParameterStoreSecureString({
            parameterName: o.githubTokenParameterName,
            version: 1
        });
        const sourceOutput = new codepipeline.Artifact();
        const sourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: o.githubOwner,
            repo: o.githubRepo,
            oauthToken: token,
            output: sourceOutput,
            branch: o.githubBranch,
        });
        const project = new codebuild.PipelineProject(this, `${o.prefix}-cicd-codebuild`);
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput,
            output: new codepipeline.Artifact(), // optional
        });

        const deployAction = new codepipeline_actions.S3DeployAction({
            actionName: 'S3Deploy',
            input: buildAction.outputs[0],
            bucket: bucket,

        });

        new codepipeline.Pipeline(this, `${options.prefix}-cicd-pipeline`, {
            stages: [
                {name: 'Source', actions: [sourceAction]},
                {name: 'Build', actions: [buildAction]},
                {name: 'Deploy', actions: [deployAction]},

            ]
        });
    }
}

export class Options {
    prefix: string;
    useCloudFront: boolean;
    githubOwner: string;
    githubBranch: string;
    githubRepo: string;
}