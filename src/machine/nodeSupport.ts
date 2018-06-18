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

import {
    Configuration,
    logger,
} from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import {
    allSatisfied,
    hasFile,
    not,
    ProductionEnvironment,
    RepoContext,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StagingEnvironment,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/dsl/buildDsl";
import {
    DockerBuildGoal,
    VersionGoal,
} from "@atomist/sdm/goal/common/commonGoals";
import { createKubernetesData } from "@atomist/sdm/handlers/events/delivery/goals/k8s/launchGoalK8";
import { SdmGoal } from "@atomist/sdm/ingesters/sdmGoalIngester";
import {
    executePublish,
    NpmOptions,
} from "@atomist/sdm/internal/delivery/build/local/npm/executePublish";
import { NodeProjectIdentifier } from "@atomist/sdm/internal/delivery/build/local/npm/nodeProjectIdentifier";
import { NodeProjectVersioner } from "@atomist/sdm/internal/delivery/build/local/npm/nodeProjectVersioner";
import {
    nodeBuilder,
    NpmPreparations,
} from "@atomist/sdm/internal/delivery/build/local/npm/npmBuilder";
import { executeVersioner } from "@atomist/sdm/internal/delivery/build/local/projectVersioner";
import { IsNode } from "@atomist/sdm/mapping/pushtest/node/nodePushTests";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
    executeDockerBuild,
} from "@atomist/sdm/pack/docker/executeDockerBuild";
import { PackageLockFingerprinter } from "@atomist/sdm/pack/node/PackageLockFingerprinter";
import { tslintFix } from "@atomist/sdm/pack/node/tslint";
import { tagRepo } from "@atomist/sdm/util/github/tagRepo";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import { AutomationClientTagger } from "../support/tagger";
import {
    ProductionDeploymentGoal,
    PublishGoal,
    ReleaseDockerGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseTagGoal,
    ReleaseVersionGoal,
    StagingDeploymentGoal,
} from "./goals";
import {
    DockerReleasePreparations,
    DocsReleasePreparations,
    executeReleaseDocker,
    executeReleaseDocs,
    executeReleaseNpm,
    executeReleaseTag,
    executeReleaseVersion,
    NpmReleasePreparations,
} from "./release";

/**
 * Add Node.js implementations of goals to SDM.
 *
 * @param sdm Softare Delivery machine to modify
 * @return modified software delivery machine
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    const hasPackageLock = hasFile("package-lock.json");

    sdm.addBuildRules(
        build.when(IsNode, hasPackageLock)
            .itMeans("npm run build")
            .set(nodeBuilder(sdm.configuration.sdm.projectLoader, "npm -v", "npm ci", "npm run build")),
        build.when(IsNode, not(hasPackageLock))
            .itMeans("npm run build (no package-lock.json)")
            .set(nodeBuilder(sdm.configuration.sdm.projectLoader, "npm -v", "npm install", "npm run build")));

    sdm.addGoalImplementation("nodeVersioner", VersionGoal,
        executeVersioner(sdm.configuration.sdm.projectLoader, NodeProjectVersioner), { pushTest: IsNode })
        .addGoalImplementation("nodeDockerBuild", DockerBuildGoal,
            executeDockerBuild(
                sdm.configuration.sdm.projectLoader,
                DefaultDockerImageNameCreator,
                NpmPreparations,
                {
                    ...sdm.configuration.sdm.docker.hub as DockerOptions,
                    dockerfileFinder: async () => "Dockerfile",
                }), { pushTest: IsNode })
        .addGoalImplementation("nodePublish", PublishGoal,
            executePublish(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmPreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }), { pushTest: IsNode })
        .addGoalImplementation("nodeNpmRelease", ReleaseNpmGoal,
            executeReleaseNpm(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmReleasePreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }), { pushTest: IsNode })
        .addGoalImplementation("nodeDockerRelease", ReleaseDockerGoal,
            executeReleaseDocker(sdm.configuration.sdm.projectLoader,
                DockerReleasePreparations,
                {
                    ...sdm.configuration.sdm.docker.hub as DockerOptions,
                }), { pushTest: allSatisfied(IsNode, hasFile("Dockerfile")) })
        .addGoalImplementation("tagRelease", ReleaseTagGoal, executeReleaseTag(sdm.configuration.sdm.projectLoader))
        .addGoalImplementation("nodeDocsRelease", ReleaseDocsGoal,
            executeReleaseDocs(sdm.configuration.sdm.projectLoader, DocsReleasePreparations), { pushTest: IsNode })
        .addGoalImplementation("nodeVersionRelease", ReleaseVersionGoal,
            executeReleaseVersion(sdm.configuration.sdm.projectLoader, NodeProjectIdentifier), { pushTest: IsNode });

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
            callback: kubernetesDataCallback(sdm.configuration),
        })
        .addFullfillmentCallback({
            goal: ProductionDeploymentGoal,
            callback: kubernetesDataCallback(sdm.configuration),
        });

    sdm.addAutofixes(
        AddAtomistTypeScriptHeader,
        AddThirdPartyLicense,
    );

    sdm.addNewRepoWithCodeActions(tagRepo(AutomationClientTagger))
        .addAutofixes(tslintFix)
        .addFingerprinterRegistrations(new PackageLockFingerprinter());

    return sdm;
}

function kubernetesDataCallback(
    configuration: SoftwareDeliveryMachineConfiguration,
): (goal: SdmGoal, context: RepoContext) => Promise<SdmGoal> {

    return async (goal, ctx) => {
        return configuration.sdm.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {
            return kubernetesDataFromGoal(goal, p, configuration);
        });
    };
}

function kubernetesDataFromGoal(
    goal: SdmGoal,
    p: GitProject,
    configuration: Configuration,
): Promise<SdmGoal> {

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
    if (/-sdm$/.test(name) && name !== "sample-sdm") {
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
