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
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import {
    allSatisfied,
    BuildGoal,
    hasFile,
    not,
    ProductionEnvironment,
    RepoContext,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    createKubernetesData,
    DefaultDockerImageNameCreator,
    DockerBuildGoal,
    DockerOptions,
    executeDockerBuild,
    executePublish,
    executeVersioner,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmOptions,
    NpmPreparations,
    PackageLockFingerprinter,
    tagRepo,
    tslintFix,
    VersionGoal,
} from "@atomist/sdm-core";
import { kubernetesSupport } from "@atomist/sdm-pack-k8";
import { executeBuild } from "@atomist/sdm/api-helper/goal/executeBuild";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import { AutomationClientTagger } from "../support/tagger";
import {
    ProductionDeploymentGoal,
    PublishGoal,
    ReleaseChangelogGoal,
    ReleaseDockerGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseTagGoal,
    ReleaseVersionGoal,
    SmokeTestGoal,
    StagingDeploymentGoal,
} from "./goals";
import {
    DockerReleasePreparations,
    DocsReleasePreparations,
    executeReleaseChangelog,
    executeReleaseDocker,
    executeReleaseDocs,
    executeReleaseNpm,
    executeReleaseTag,
    executeReleaseVersion,
    NpmReleasePreparations,
} from "./release";
import { executeSmokeTests } from "./smokeTest";

const NodeDefaultOptions = {
    pushTest: IsNode,
    logInterpreter: LogSuppressor,
};

/**
 * Add Node.js implementations of goals to SDM.
 *
 * @param sdm Softare Delivery machine to modify
 * @return modified software delivery machine
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    const hasPackageLock = hasFile("package-lock.json");

    sdm.addGoalImplementation(
            "npm run build",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeBuilder(sdm, "npm ci", "npm run build")),
            {
                pushTest: allSatisfied(IsNode, not(hasPackageLock)),
                logInterpreter: NodeDefaultOptions.logInterpreter,
            },
        )
        .addGoalImplementation(
            "npm run build (no package-lock.json)",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeBuilder(sdm, "npm i", "npm run build")),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeVersioner",
            VersionGoal,
            executeVersioner(sdm.configuration.sdm.projectLoader, NodeProjectVersioner),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeDockerBuild",
            DockerBuildGoal,
            executeDockerBuild(
                sdm.configuration.sdm.projectLoader,
                DefaultDockerImageNameCreator,
                NpmPreparations,
                {
                    ...sdm.configuration.sdm.docker.hub as DockerOptions,
                    dockerfileFinder: async () => "Dockerfile",
                }),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodePublish",
            PublishGoal,
            executePublish(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmPreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeNpmRelease",
            ReleaseNpmGoal,
            executeReleaseNpm(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmReleasePreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeSmokeTest",
            SmokeTestGoal,
            executeSmokeTests(sdm.configuration.sdm.projectLoader, {
                    team: "AHF8B2MBL",
                    org: "sample-sdm-fidelity",
                    port: 2867,
                }, new GitHubRepoRef("atomist", "sdm-smoke-test"),
                "nodeBuild",
            ),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeDockerRelease",
            ReleaseDockerGoal,
            executeReleaseDocker(sdm.configuration.sdm.projectLoader,
                DockerReleasePreparations,
                {
                    ...sdm.configuration.sdm.docker.hub as DockerOptions,
                }),
            {
                pushTest: allSatisfied(IsNode, hasFile("Dockerfile")),
                logInterpreter: NodeDefaultOptions.logInterpreter,
            },
        )
        .addGoalImplementation(
            "nodeTagRelease",
            ReleaseTagGoal,
            executeReleaseTag(sdm.configuration.sdm.projectLoader),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeDocsRelease",
            ReleaseDocsGoal,
            executeReleaseDocs(sdm.configuration.sdm.projectLoader, DocsReleasePreparations),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeVersionRelease",
            ReleaseVersionGoal,
            executeReleaseVersion(sdm.configuration.sdm.projectLoader, NodeProjectIdentifier),
            NodeDefaultOptions,
        )
        .addGoalImplementation(
            "nodeReleaseChangelog",
            ReleaseChangelogGoal,
            executeReleaseChangelog(sdm.configuration.sdm.projectLoader),
            NodeDefaultOptions,
        );

    sdm.addExtensionPacks(
        kubernetesSupport({
            deployments: [ {
                goal: StagingDeploymentGoal,
                pushTest: IsNode,
                callback: kubernetesDataCallback(sdm.configuration),
            }, {
                goal: ProductionDeploymentGoal,
                pushTest: IsNode,
                callback: kubernetesDataCallback(sdm.configuration),
            } ],
        }),
    );

    sdm.addAutofix(AddAtomistTypeScriptHeader)
        .addAutofix(AddThirdPartyLicense);

    sdm.addNewRepoWithCodeAction(tagRepo(AutomationClientTagger))
        .addAutofix(tslintFix)
        .addFingerprinterRegistration(new PackageLockFingerprinter());

    return sdm;
}

function kubernetesDataCallback(
    configuration: SoftwareDeliveryMachineConfiguration,
): (goal: SdmGoalEvent, context: RepoContext) => Promise<SdmGoalEvent> {

    return async (goal, ctx) => {
        return configuration.sdm.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {
            return kubernetesDataFromGoal(goal, p, configuration);
        });
    };
}

function kubernetesDataFromGoal(
    goal: SdmGoalEvent,
    p: GitProject,
    configuration: Configuration,
): Promise<SdmGoalEvent> {

    const ns = namespaceFromGoal(goal);
    const host = hostFromGoal(goal);
    return createKubernetesData(
        goal,
        {
            name: goal.repo.name,
            environment: configuration.environment,
            port: 2866,
            ns,
            imagePullSecret: "atomistjfrog",
            replicas: ns === "production" ? 3 : 1,
            host,
        },
        p);
}

function namespaceFromGoal(goal: SdmGoalEvent): string {
    const name = goal.repo.name;
    if (/-sdm$/.test(name) && name !== "sample-sdm" && name !== "spring-sdm") {
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

function hostFromGoal(goal: SdmGoalEvent): string {
    const name = goal.repo.name;
    if (name === "card-automation") {
        return "pusher";
    } else {
        return undefined;
    }
}
