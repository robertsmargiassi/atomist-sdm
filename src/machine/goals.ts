// GOAL Definition

import {
    AutofixGoal,
    BuildGoal,
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

export const ProductionDeploymentGoal = new GoalWithPrecondition({
    uniqueName: "DeployToProduction",
    environment: ProductionEnvironment,
    orderedName: "3-prod-deploy",
    displayName: "deploy to Prod",
    completedDescription: "Deployed to Prod",
    failedDescription: "Prod deployment failure",
}, StagingDeploymentGoal);

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
    "Automation Client Kubernetes Deploy",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    StagingDeploymentGoal,
    ProductionDeploymentGoal,
);
