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

import { automationClientInstance } from "@atomist/automation-client/automationClient";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { AddAtomistTypeScriptHeader } from "@atomist/sample-sdm/blueprint/code/autofix/addAtomistHeader";
import { CommonTypeScriptErrors } from "@atomist/sample-sdm/parts/team/commonTypeScriptErrors";
import { DontImportOwnIndex } from "@atomist/sample-sdm/parts/team/dontImportOwnIndex";
import {
    hasFile,
    IsAtomistAutomationClient,
    nodeBuilder,
    not,
    ProductionEnvironment,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    StagingEnvironment,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import { RepoContext } from "@atomist/sdm/common/context/SdmContext";
import { executeTag } from "@atomist/sdm/common/delivery/build/executeTag";
import { executePublish } from "@atomist/sdm/common/delivery/build/local/npm/executePublish";
import { NodeProjectIdentifier } from "@atomist/sdm/common/delivery/build/local/npm/nodeProjectIdentifier";
import { NodeProjectVersioner } from "@atomist/sdm/common/delivery/build/local/npm/nodeProjectVersioner";
import { NpmPreparations } from "@atomist/sdm/common/delivery/build/local/npm/npmBuilder";
import { npmCustomBuilder } from "@atomist/sdm/common/delivery/build/local/npm/NpmDetectBuildMapping";
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
    NoGoals,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import { IsDeployEnabled } from "@atomist/sdm/common/listener/support/pushtest/deployPushTests";
import { HasDockerfile } from "@atomist/sdm/common/listener/support/pushtest/docker/dockerPushTests";
import {
    HasAtomistBuildFile,
    IsNode,
} from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { tagRepo } from "@atomist/sdm/common/listener/support/tagRepo";
import { createKubernetesData } from "@atomist/sdm/handlers/events/delivery/goals/k8s/launchGoalK8";
import { SdmGoal } from "@atomist/sdm/ingesters/sdmGoalIngester";
import { nodeTagger } from "@atomist/spring-automation/commands/tag/nodeTagger";
import { MaterialChange } from "../pushtest/materialChange";
import {
    BuildGoals,
    DockerGoals,
    KubernetesDeployGoals,
    ProductionDeploymentGoal,
    PublishGoal,
    StagingDeploymentGoal,
} from "./goals";

export type MachineOptions = SoftwareDeliveryMachineOptions & DockerOptions;

export function machine(options: MachineOptions): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        "Automation Client Software Delivery Machine",
        options,

        whenPushSatisfies(not(MaterialChange))
            .itMeans("No material change")
            .setGoals(NoGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient)
            .itMeans("Automation Client Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, IsAtomistAutomationClient)
            .itMeans("Automation Client Docker Build")
            .setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), IsAtomistAutomationClient)
            .itMeans("Automation Client Build")
            .setGoals(BuildGoals),
    );

    sdm.addNewRepoWithCodeActions(
            tagRepo(nodeTagger),
        )
        .addAutofixes(
            AddAtomistTypeScriptHeader,
            tslintFix,
        )
        .addReviewerRegistrations(
            CommonTypeScriptErrors,
            DontImportOwnIndex,
        )
        .addFingerprinterRegistrations(new PackageLockFingerprinter());

    const hasPackageLock = hasFile("package-lock.json");

    sdm.addBuildRules(
        build.when(HasAtomistBuildFile)
            .itMeans("Custom build script")
            .set(npmCustomBuilder(options.artifactStore, options.projectLoader)),
        build.when(hasPackageLock)
            .itMeans("npm run build")
            .set(nodeBuilder(options.projectLoader, "npm ci", "npm run build")),
        build.when(not(hasPackageLock))
            .itMeans("npm run build (no package-lock.json)")
            .set(nodeBuilder(options.projectLoader, "npm install", "npm run build")));

    sdm.addGoalImplementation("nodeVersioner", VersionGoal,
            executeVersioner(options.projectLoader, NodeProjectVersioner))
        .addGoalImplementation("nodeDockerBuild", DockerBuildGoal,
            executeDockerBuild(
                options.projectLoader,
                DefaultDockerImageNameCreator,
                NpmPreparations,
                {
                    registry: options.registry,
                    user: options.user,
                    password: options.password,

                    dockerfileFinder: async () => "Dockerfile",
                }))
        .addGoalImplementation("nodeTag", TagGoal,
            executeTag(options.projectLoader))
        .addGoalImplementation("nodePublish", PublishGoal,
            executePublish(options.projectLoader, NodeProjectIdentifier, NpmPreparations));

    sdm.goalFulfillmentMapper
        .addSideEffect({
            goal: StagingDeploymentGoal,
            pushTest: IsNode,
            sideEffectName: "@atomist/k8-automation" })
        .addSideEffect({
            goal: ProductionDeploymentGoal,
            pushTest: IsNode,
            sideEffectName: "@atomist/k8-automation" })

        .addFullfillmentCallback({
            goal: StagingDeploymentGoal,
            callback: kubernetesDataCallback(options),
        })
        .addFullfillmentCallback({
            goal: ProductionDeploymentGoal,
            callback: kubernetesDataCallback(options),
        });

    return sdm;
}

function kubernetesDataCallback(options: MachineOptions): (goal: SdmGoal, context: RepoContext) => Promise<SdmGoal> {
    return async (goal, ctx) => {
        return options.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {
            return kubernetesDataFromGoal(goal, p);
        });
    };
}

function kubernetesDataFromGoal(goal: SdmGoal, p: GitProject): Promise<SdmGoal> {
    return createKubernetesData(
        goal,
        {
            name: goal.repo.name,
            environment: automationClientInstance().configuration.environment,
            port: 2866,
            ns: namespaceFromFoal(goal),
            imagePullSecret: "atomistjfrog",
        },
        p);
}

function namespaceFromFoal(goal: SdmGoal): string {
    const name = goal.repo.name;
    if (name === "automation-client-sdm") {
        return "sdm";
    } else if (name === "k8-automation") {
        return "k8-automation";
    } else if (goal.environment === StagingEnvironment) {
        return "testing";
    } else if (goal.environment === ProductionEnvironment) {
        return "production";
    } else {
        return "default";
    }
}
