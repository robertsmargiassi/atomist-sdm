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

import { logger } from "@atomist/automation-client";
import { automationClientInstance } from "@atomist/automation-client/automationClient";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { AddAtomistTypeScriptHeader } from "@atomist/sample-sdm/blueprint/code/autofix/addAtomistHeader";
import { whackHeaderEditor } from "@atomist/sample-sdm/commands/editors/demo/removeTypeScriptHeader";
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
import { IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { tagRepo } from "@atomist/sdm/common/listener/support/tagRepo";
import {
    disableDeploy,
    enableDeploy,
} from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import { createKubernetesData } from "@atomist/sdm/handlers/events/delivery/goals/k8s/launchGoalK8";
import { SdmGoal } from "@atomist/sdm/ingesters/sdmGoalIngester";
import { MaterialChange } from "../support/materialChange";
import { simplifiedDeployment } from "../support/simplifiedDeployment";
import { AutomationClientTagger } from "../support/tagger";
import {
    BuildGoals,
    DockerGoals,
    KubernetesDeployGoals,
    ProductionDeploymentGoal,
    PublishGoal,
    SimplifiedKubernetesDeployGoals,
    StagingDeploymentGoal,
} from "./goals";

export type MachineOptions = SoftwareDeliveryMachineOptions & DockerOptions;

export function machine(options: MachineOptions): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        "Automation Client Software Delivery Machine",
        options,

        whenPushSatisfies(not(MaterialChange))
            .itMeans("No Material Change")
            .setGoals(NoGoals),

        // Simplified deployment goalset for automation-client-sdm and k8-automation; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient,
            simplifiedDeployment("k8-automation", "automation-client-sdm"))
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, IsAtomistAutomationClient)
            .itMeans("Docker Build")
            .setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), IsAtomistAutomationClient)
            .itMeans("Build")
            .setGoals(BuildGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), not(IsAtomistAutomationClient))
            .itMeans("Module Build")
            .setGoals(BuildGoals),
    );

    sdm.addSupportingCommands(
            enableDeploy,
            disableDeploy,
        )
        .addNewRepoWithCodeActions(
            tagRepo(AutomationClientTagger),
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
            sideEffectName: "@atomist/k8-automation",
        })
        .addSideEffect({
            goal: ProductionDeploymentGoal,
            pushTest: IsNode,
            sideEffectName: "@atomist/k8-automation",
        })

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
            const newGoal = await kubernetesDataFromGoal(goal, p);
            const goalData = JSON.parse(newGoal.data);

            if (goalData.kubernetes.ns === "production"
                && goalData.kubernetes.deploymentSpec
                && goalData.kubernetes.deploymentSpec.spec) {
                goalData.kubernetes.deploymentSpec.spec.replicas === 3;
                newGoal.data = JSON.stringify(goalData);
            }

            return newGoal;
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
            ns: namespaceFromGoal(goal),
            imagePullSecret: "atomistjfrog",
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
