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
    hasFile,
    not,
    ProductionEnvironment,
    RepoContext,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StagingEnvironment,
} from "@atomist/sdm";
import { tagRepo } from "@atomist/sdm-core";
import { KubernetesOptions } from "@atomist/sdm-core/handlers/events/delivery/goals/k8s/launchGoalK8";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { DockerOptions } from "@atomist/sdm-pack-docker";
import { DefaultDockerImageNameCreator } from "@atomist/sdm-pack-docker/docker/executeDockerBuild";
import { kubernetesSupport } from "@atomist/sdm-pack-k8";
import { createKubernetesData } from "@atomist/sdm-pack-k8";
import {
    executePublish,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmOptions,
    NpmPreparations,
    NpmProgressReporter,
    PackageLockFingerprinter,
    tslintFix,
} from "@atomist/sdm-pack-node";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import { npmDockerfileFix } from "../autofix/npm/dockerfileFix";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import { AutomationClientTagger } from "../support/tagger";
import { TryToUpdateAtomistDependencies } from "../transform/tryToUpdateAtomistDependencies";
import { TryToUpdateAtomistPeerDependencies } from "../transform/tryToUpdateAtomistPeerDependencies";
import { UpdatePackageAuthor } from "../transform/updatePackageAuthor";
import { UpdatePackageVersion } from "../transform/updatePackageVersion";
import {
    AutofixGoal,
    BuildGoal,
    DockerBuildGoal,
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
    TagGoal,
    VersionGoal,
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
import { executeSmokeTests } from "./smokeTest";

const NodeDefaultOptions = {
    pushTest: IsNode,
    logInterpreter: LogSuppressor,
    progressReporter: NpmProgressReporter,
};

/**
 * Add Node.js implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    const hasPackageLock = hasFile("package-lock.json");

    VersionGoal.with({
        ...NodeDefaultOptions,
        name: "npm-versioner",
        versioner: NodeProjectVersioner,

    });

    AutofixGoal.with(AddAtomistTypeScriptHeader)
        .with(tslintFix)
        .with(AddThirdPartyLicense)
        .with(npmDockerfileFix("npm", "@atomist/cli"));

    BuildGoal.with({
        ...NodeDefaultOptions,
        name: "npm-ci-npm-run-build",
        builder: nodeBuilder(sdm, "npm ci", "npm run build"),
        pushTest: allSatisfied(IsNode, hasPackageLock),
    })
    .with({
        ...NodeDefaultOptions,
        name: "npm-i-npm-run-build",
        builder: nodeBuilder(sdm, "npm i", "npm run build"),
        pushTest: allSatisfied(IsNode, not(hasPackageLock)),
    });

    PublishGoal.with({
        ...NodeDefaultOptions,
        name: "npm-publish",
        goalExecutor: executePublish(sdm.configuration.sdm.projectLoader,
            NodeProjectIdentifier,
            NpmPreparations,
            {
                ...sdm.configuration.sdm.npm as NpmOptions,
            }),
    });

    TagGoal.with({
        name: "npm-tag",
        ...NodeDefaultOptions,
    });

    DockerBuildGoal.with({
        ...NodeDefaultOptions,
        name: "npm-docker-build",
        preparations: NpmPreparations,
        imageNameCreator: DefaultDockerImageNameCreator,
        options: sdm.configuration.sdm.docker.hub as DockerOptions,
    });

    ReleaseNpmGoal.with({
        ...NodeDefaultOptions,
        name: "npm-release",
        goalExecutor: executeReleaseNpm(
            NodeProjectIdentifier,
            NpmReleasePreparations,
            {
                ...sdm.configuration.sdm.npm as NpmOptions,
            }),
    });

    SmokeTestGoal.with({
        ...NodeDefaultOptions,
        name: "npm-smoke-test",
        goalExecutor: executeSmokeTests({
                team: "AHF8B2MBL",
                org: "sample-sdm-fidelity",
                port: 2867,
            }, new GitHubRepoRef("atomist", "sdm-smoke-test"),
            "nodeBuild",
        ),
    });

    ReleaseDockerGoal.with({
        name: "npm-docker-release",
        goalExecutor: executeReleaseDocker(
            DockerReleasePreparations,
            {
                ...sdm.configuration.sdm.docker.hub as DockerOptions,
            }),
        pushTest: allSatisfied(IsNode, hasFile("Dockerfile")),
        logInterpreter: NodeDefaultOptions.logInterpreter,
    });

    ReleaseTagGoal.with({
        ...NodeDefaultOptions,
        name: "npm-tag-release",
        goalExecutor: executeReleaseTag(),
    });

    ReleaseDocsGoal.with({
        ...NodeDefaultOptions,
        name: "npm-docs-release",
        goalExecutor: executeReleaseDocs(DocsReleasePreparations),
    });

    ReleaseVersionGoal.with({
        ...NodeDefaultOptions,
        name: "npm-release-version",
        goalExecutor: executeReleaseVersion(NodeProjectIdentifier),
    });

    sdm.addExtensionPacks(
        changelogSupport(ReleaseChangelogGoal),
        kubernetesSupport({
            deployments: [{
                goal: StagingDeploymentGoal,
                pushTest: IsNode,
                callback: kubernetesDataCallback(sdm.configuration),
            }, {
                goal: ProductionDeploymentGoal,
                pushTest: IsNode,
                callback: kubernetesDataCallback(sdm.configuration),
            }],
        }),
    );

    sdm.addFirstPushListener(tagRepo(AutomationClientTagger))
        .addFingerprinterRegistration(new PackageLockFingerprinter());

    sdm.addEvent(deleteDistTagOnBranchDeletion(
        sdm.configuration.sdm.projectLoader,
        sdm.configuration.sdm.npm as NpmOptions));

    sdm.addCodeTransformCommand(TryToUpdateAtomistDependencies)
        .addCodeTransformCommand(UpdatePackageVersion)
        .addCodeTransformCommand(TryToUpdateAtomistPeerDependencies)
        .addCodeTransformCommand(UpdatePackageAuthor);

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
    const ingress = ingressFromGoal(goal.repo.name, ns);
    return createKubernetesData(
        goal,
        {
            name: goal.repo.name,
            environment: configuration.environment.split("_")[0],
            port: 2866,
            ns,
            imagePullSecret: "atomistjfrog",
            replicas: ns === "production" ? 3 : 1,
            ...ingress,
        } as KubernetesOptions,
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

export interface Ingress {
    host: string;
    path: string;
    tlsSecret?: string;
}

export function ingressFromGoal(repo: string, ns: string): Ingress {
    let host: string;
    let path: string;
    if (repo === "card-automation") {
        host = "pusher";
        path = "/";
    } else if (repo === "sdm-automation") {
        return {
            host: "badge",
            path: "/",
        };
    } else if (repo === "intercom-automation") {
        host = "intercom";
        path = "/";
    } else {
        return undefined;
    }
    const tail = (ns === "production") ? "com" : "services";
    return {
        host: `${host}.atomist.${tail}`,
        path,
        tlsSecret: `star-atomist-${tail}`,
    };
}
