/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// GOAL Definition

import {
    Autofix,
    Build,
    CodeInspectionGoal,
    Fingerprint,
    goals,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    ProductionEnvironment,
    PushReactionGoal,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    Tag,
    Version,
} from "@atomist/sdm-core";
import { releaseChangelogGoal } from "@atomist/sdm-pack-changelog";
import { DockerBuild } from "@atomist/sdm-pack-docker";

export const VersionGoal = new Version();
export const AutofixGoal = new Autofix();
export const BuildGoal = new Build();
export const TagGoal = new Tag();
export const DockerBuildGoal = new DockerBuild();
export const FingerprintGoal = new Fingerprint();

export const PublishGoal = new GoalWithFulfillment({
    uniqueName: "publish",
    environment: IndependentOfEnvironment,
    displayName: "publish",
    workingDescription: "Publishing",
    completedDescription: "Published",
    failedDescription: "Publish failed",
    isolated: true,
}, BuildGoal, DockerBuildGoal);

export const StagingDeploymentGoal = new GoalWithFulfillment({
    uniqueName: "deploy-to-test",
    environment: StagingEnvironment,
    displayName: "deploy to Test",
    completedDescription: "Deployed to Test",
    failedDescription: "Test deployment failure",
    waitingForApprovalDescription: "Successfully deployed to Test",
    approvalRequired: true,
}, DockerBuildGoal);

export const ProductionDeploymentGoal = new GoalWithFulfillment({
    uniqueName: "deploy-to-production",
    environment: ProductionEnvironment,
    displayName: "deploy to Prod",
    completedDescription: "Deployed to Prod",
    failedDescription: "Prod deployment failure",
});

export const ReleaseNpmGoal = new GoalWithFulfillment({
    uniqueName: "release-npm",
    environment: ProductionEnvironment,
    displayName: "release NPM package",
    workingDescription: "Releasing NPM package",
    completedDescription: "Released NPM package",
    failedDescription: "Release NPM package failure",
    isolated: true,
});

export const ReleaseDockerGoal = new GoalWithFulfillment({
    uniqueName: "release-docker",
    environment: ProductionEnvironment,
    displayName: "release Docker image",
    workingDescription: "Releasing Docker image",
    completedDescription: "Released Docker image",
    failedDescription: "Release Docker image failure",
    isolated: true,
});

export const ReleaseTagGoal = new GoalWithFulfillment({
    uniqueName: "release-tag",
    environment: ProductionEnvironment,
    displayName: "create release tag",
    workingDescription: "Creating release tag",
    completedDescription: "Created release tag",
    failedDescription: "Creating release tag failure",
});

export const ReleaseDocsGoal = new GoalWithFulfillment({
    uniqueName: "release-docs",
    environment: ProductionEnvironment,
    displayName: "publish docs",
    workingDescription: "Publishing docs",
    completedDescription: "Published docs",
    failedDescription: "Publishing docs failure",
    isolated: true,
});

export const ReleaseChangelogGoal = releaseChangelogGoal(ReleaseDocsGoal);

export const ReleaseVersionGoal = new GoalWithFulfillment({
    uniqueName: "release-version",
    environment: ProductionEnvironment,
    displayName: "increment version",
    workingDescription: "Incrementing version",
    completedDescription: "Incremented version",
    failedDescription: "Incrementing version failure",
}, ReleaseChangelogGoal);

export const SmokeTestGoal = new GoalWithFulfillment({
    uniqueName: "smoke-test",
    environment: ProductionEnvironment,
    displayName: "smoke test",
    workingDescription: "Running smoke tests",
    completedDescription: "Run smoke tests",
    failedDescription: "Smoke test failure",
    isolated: true,
}, BuildGoal);

// GOALSET Definition

// Just running review and autofix
export const CheckGoals = goals("Check")
    .plan(VersionGoal, CodeInspectionGoal, AutofixGoal, PushReactionGoal, FingerprintGoal);

// Goals for running in local mode
export const LocalGoals = goals("Local Build")
    .plan(CheckGoals)
    .plan(BuildGoal).after(AutofixGoal, VersionGoal)
    .plan(DockerBuildGoal).after(BuildGoal)
    .plan(StagingDeploymentGoal).after(DockerBuildGoal);

// Just running the build and publish
export const BuildGoals = goals("Build")
    .plan(CheckGoals)
    .plan(BuildGoal).after(AutofixGoal, VersionGoal)
    .plan(TagGoal, PublishGoal).after(BuildGoal);

// Just running the build and publish
export const BuildReleaseGoals = goals("Build with Release")
    .plan(CheckGoals)
    .plan(BuildGoal).after(AutofixGoal, VersionGoal)
    .plan(TagGoal).after(BuildGoal)
    .plan({ ...PublishGoal.definition, approvalRequired: true }).after(BuildGoal)
    .plan(ReleaseNpmGoal, ReleaseDocsGoal).after(PublishGoal)
    .plan(ReleaseTagGoal).after(ReleaseNpmGoal)
    .plan(ReleaseChangelogGoal, ReleaseVersionGoal);

// Build including docker build
export const DockerGoals = goals("Docker Build")
    .plan(BuildGoals)
    .plan(DockerBuildGoal).after(BuildGoal);

// Build including docker build
export const DockerReleaseGoals = goals("Docker Build with Release")
    .plan(CheckGoals)
    .plan(BuildGoal).after(AutofixGoal, VersionGoal)
    .plan(DockerBuildGoal).after(BuildGoal)
    .plan(TagGoal).after(DockerBuildGoal)
    .plan({ ...PublishGoal.definition, approvalRequired: true }).after(BuildGoal, DockerBuildGoal)
    .plan(ReleaseNpmGoal, ReleaseDockerGoal, ReleaseDocsGoal).after(PublishGoal)
    .plan(ReleaseTagGoal).after(ReleaseNpmGoal, ReleaseDockerGoal)
    .plan(ReleaseChangelogGoal, ReleaseVersionGoal);

// Docker build and testing and production kubernetes deploy
export const KubernetesDeployGoals = goals("Deploy")
    .plan(DockerGoals, StagingDeploymentGoal)
    .plan(ProductionDeploymentGoal, ReleaseNpmGoal, ReleaseDockerGoal , ReleaseDocsGoal).after(StagingDeploymentGoal)
    .plan(ReleaseTagGoal).after(ReleaseNpmGoal, ReleaseDockerGoal)
    .plan(ReleaseChangelogGoal, ReleaseVersionGoal);

// Docker build and testing and production kubernetes deploy
export const SimplifiedKubernetesDeployGoals = goals("Simplified Deploy")
    .plan(DockerGoals)
    .plan({ ...ProductionDeploymentGoal.definition, approvalRequired: true }).after(DockerBuildGoal)
    .plan(ReleaseNpmGoal, ReleaseDockerGoal, ReleaseDocsGoal).after(ProductionDeploymentGoal)
    .plan(ReleaseTagGoal).after(ReleaseNpmGoal, ReleaseDockerGoal)
    .plan(ReleaseChangelogGoal, ReleaseVersionGoal);

// Only deploy to staging
export const StagingKubernetesDeployGoals = goals("Staging Deploy")
    .plan(DockerGoals, SmokeTestGoal)
    .plan({ ...StagingDeploymentGoal.definition, approvalRequired: false }).after(DockerBuildGoal);
