import {
    Configuration,
    logger,
} from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import {
    hasFile,
    nodeBuilder,
    not,
    ProductionEnvironment,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    StagingEnvironment,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import { RepoContext } from "@atomist/sdm/common/context/SdmContext";
import {
    executePublish,
    NpmOptions,
} from "@atomist/sdm/common/delivery/build/local/npm/executePublish";
import { NodeProjectIdentifier } from "@atomist/sdm/common/delivery/build/local/npm/nodeProjectIdentifier";
import { NodeProjectVersioner } from "@atomist/sdm/common/delivery/build/local/npm/nodeProjectVersioner";
import { NpmPreparations } from "@atomist/sdm/common/delivery/build/local/npm/npmBuilder";
import { executeVersioner } from "@atomist/sdm/common/delivery/build/local/projectVersioner";
import { tslintFix } from "@atomist/sdm/common/delivery/code/autofix/node/tslint";
import { PackageLockFingerprinter } from "@atomist/sdm/common/delivery/code/fingerprint/node/PackageLockFingerprinter";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
    executeDockerBuild,
} from "@atomist/sdm/common/delivery/docker/executeDockerBuild";
import {
    DockerBuildGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import { IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { tagRepo } from "@atomist/sdm/common/listener/support/tagRepo";
import { createKubernetesData } from "@atomist/sdm/handlers/events/delivery/goals/k8s/launchGoalK8";
import { SdmGoal } from "@atomist/sdm/ingesters/sdmGoalIngester";
import { AutomationClientTagger } from "../support/tagger";
import {
    ProductionDeploymentGoal,
    PublishGoal,
    StagingDeploymentGoal,
} from "./goals";

export function addNodeSupport(sdm: SoftwareDeliveryMachine,
                               configuration:Configuration) {

    const hasPackageLock = hasFile("package-lock.json");

    sdm.addBuildRules(
        build.when(hasPackageLock)
            .itMeans("npm run build")
            .set(nodeBuilder(sdm.opts.projectLoader, "npm ci", "npm run build")),
        build.when(not(hasPackageLock))
            .itMeans("npm run build (no package-lock.json)")
            .set(nodeBuilder(sdm.opts.projectLoader, "npm install", "npm run build")));

    sdm.addGoalImplementation("nodeVersioner", VersionGoal,
        executeVersioner(sdm.opts.projectLoader, NodeProjectVersioner))
        .addGoalImplementation("nodeDockerBuild", DockerBuildGoal,
            executeDockerBuild(
                sdm.opts.projectLoader,
                DefaultDockerImageNameCreator,
                NpmPreparations,
                {
                    ...configuration.sdm.docker.hub as DockerOptions,
                    dockerfileFinder: async () => "Dockerfile",
                }))
        .addGoalImplementation("nodePublish", PublishGoal,
            executePublish(sdm.opts.projectLoader,
                NodeProjectIdentifier,
                NpmPreparations,
                {
                    ...configuration.sdm.npm as NpmOptions,
                }));

    sdm.goalFulfillmentMapper
        .addSideEffect({
            goal: StagingDeploymentGoal,
            pushTest: IsNode,
            sideEffectName: "@atomist/k8-automation",
        })
        .addSideEffect({
            goal: ProductionDeploymentGoal,
            pushTest: IsNode,
            sideEffectName: "@atomist/k8-automation",
        })

        .addFullfillmentCallback({
            goal: StagingDeploymentGoal,
            callback: kubernetesDataCallback(sdm.opts, configuration),
        })
        .addFullfillmentCallback({
            goal: ProductionDeploymentGoal,
            callback: kubernetesDataCallback(sdm.opts, configuration),
        });

    sdm.addNewRepoWithCodeActions(tagRepo(AutomationClientTagger))
        .addAutofixes(tslintFix)
        .addFingerprinterRegistrations(new PackageLockFingerprinter());

}

function kubernetesDataCallback(options: SoftwareDeliveryMachineOptions,
                                configuration: Configuration): (goal: SdmGoal, context: RepoContext) => Promise<SdmGoal> {
    return async (goal, ctx) => {
        return options.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {
            return kubernetesDataFromGoal(goal, p, configuration);
        });
    };
}

function kubernetesDataFromGoal(goal: SdmGoal,
                                p: GitProject,
                                configuration: Configuration): Promise<SdmGoal> {
    const ns = namespaceFromGoal(goal);
    return createKubernetesData(
        goal,
        {
            name: goal.repo.name,
            environment: configuration.environment,
            port: 2866,
            ns,
            imagePullSecret: "atomistjfrog",
            replicas: ns === "production" ? 3 : 1,
        },
        p);
}

function namespaceFromGoal(goal: SdmGoal): string {
    const name = goal.repo.name;
    if (/-sdm$/.test(name)) {
        return "sdm";
    } else if (name === "k8-automation") {
        return "k8-automation";
    } else if (goal.environment === StagingEnvironment.replace(/\/$/, "")) {
        return "testing";
    } else if (goal.environment === ProductionEnvironment.replace(/\/$/, "")) {
        return "production";
    } else {
        logger.debug(`Unmatched goal.environment using default namespace: ${goal.environment}`);
        return "default";
    }
}
