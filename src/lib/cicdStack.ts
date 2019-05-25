import {Construct, SecretValue, Stack, StackProps} from "@aws-cdk/cdk";
import {Bucket, IBucket} from '@aws-cdk/aws-s3';
import {CloudFrontWebDistribution} from "@aws-cdk/aws-cloudfront";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import {ComputeType, LinuxBuildImage} from "@aws-cdk/aws-codebuild";
import {GitHubTrigger} from "@aws-cdk/aws-codepipeline-actions";
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');


export class CICDStack extends Stack {
    static PASSTHROUGH_BUILDSPEC: any = {
        version: '0.2',
        phases: {
            build: {
                commands: [
                    'env',
                ],
            },
        },
        artifacts: {
            'files': [
                '**/*',
            ],
        },
    };

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
    }

    create(options: Options) {

        const deployBucket = new Bucket(this, `${options.prefix}-cicd-deploy`, {
            websiteIndexDocument: options.useS3Hosting ? options.indexDocument || 'index.html' : undefined
        });
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

        const sourceOutput = new codepipeline.Artifact();
        // const oauth = SecretValue.ssmSecure(o.githubTokenParameterName, "1");
        // const oauth = SecretValue.cfnDynamicReference(new CfnDynamicReference(CfnDynamicReferenceService.Ssm, `${o.githubTokenParameterName}:1`));
        const oauth = SecretValue.secretsManager(o.githubTokenParameterName);
        const sourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: o.githubOwner,
            repo: o.githubRepo,
            oauthToken: oauth,
            output: sourceOutput,
            branch: o.githubBranch,
            trigger: GitHubTrigger.WebHook
        });

        let buildSpec = CICDStack.PASSTHROUGH_BUILDSPEC;
        if (typeof (o.codebuildBuildspec) === 'object') {
            buildSpec = JSON.stringify(o.codebuildBuildspec);
        } else if (o.codebuildBuildspec) {
            buildSpec = o.codebuildBuildspec;
        }
        const project = new codebuild.PipelineProject(this, `${o.prefix}-cicd-codebuild`, {
            environment: {
                buildImage: LinuxBuildImage.UBUNTU_14_04_DOCKER_18_09_0,
                computeType: ComputeType.Small,
                privileged: true
            },
            buildSpec: buildSpec
        });
        let codebuildOutputArtifact = new codepipeline.Artifact('build-output');
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput,
            output: codebuildOutputArtifact, // optional
        });

        const deployAction = new codepipeline_actions.S3DeployAction({
            actionName: 'S3Deploy',
            input: codebuildOutputArtifact,
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
    useS3Hosting: boolean;
    indexDocument: string | undefined;
    errorDocument: string | undefined;
    githubOwner: string;
    githubBranch: string;
    githubRepo: string;
    codebuildBuildspec: string | any;
}