/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// GOAL Definition

import {
    AutofixGoal,
    BuildGoal,
    Goal,
    Goals,
    GoalWithPrecondition,
    IndependentOfEnvironment,
    ProductionEnvironment,
    ReviewGoal,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    DockerBuildGoal,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";

export const PublishGoal = new GoalWithPrecondition({
    uniqueName: "Publish",
    environment: IndependentOfEnvironment,
    orderedName: "2-publish",
    displayName: "publish",
    workingDescription: "Publishing...",
    completedDescription: "Published",
    failedDescription: "Published failed",
    isolated: true,
}, BuildGoal);

export const StagingDeploymentGoal = new GoalWithPrecondition({
    uniqueName: "DeployToTest",
    environment: StagingEnvironment,
    orderedName: "3-deploy",
    displayName: "deploy to Test",
    completedDescription: "Deployed to Test",
    failedDescription: "Test deployment failure",
    waitingForApprovalDescription: "Promote to Prod",
    approvalRequired: true,
}, DockerBuildGoal);

export const ProductionDeploymentGoal = new Goal({
    uniqueName: "DeployToProduction",
    environment: ProductionEnvironment,
    orderedName: "3-prod-deploy",
    displayName: "deploy to Prod",
    completedDescription: "Deployed to Prod",
    failedDescription: "Prod deployment failure",
});

// GOALSET Definition

// Just running the build and publish
export const BuildGoals = new Goals(
    "Automation Client Build",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
    BuildGoal,
    PublishGoal,
    TagGoal,
);

// Build including docker build
export const DockerGoals = new Goals(
    "Automation Client Docker Build",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
);

// Docker build and testing and production kubernetes deploy
export const KubernetesDeployGoals = new Goals(
    "Automation Client Deploy",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    StagingDeploymentGoal,
    new GoalWithPrecondition(ProductionDeploymentGoal.definition, StagingDeploymentGoal),
);

// Docker build and testing and production kubernetes deploy
export const SimplifiedKubernetesDeployGoals = new Goals(
    "Automation Client Deploy (single env)",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    ProductionDeploymentGoal,
);