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
    DoNotSetAnyGoals,
    IsDeployEnabled,
    not,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    EnableDeploy,
    executeTag,
    HasDockerfile,
    IsAtomistAutomationClient,
    IsNode,
    NoGoals,
    summarizeGoalsInGitHubStatus,
    TagGoal,
} from "@atomist/sdm-core";
import { HasTravisFile } from "@atomist/sdm/api-helper/pushtest/ci/ciPushTests";
import { IsNamed } from "../support/identityPushTests";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import {
    BuildGoals,
    BuildReleaseGoals,
    CheckGoals,
    DockerGoals,
    DockerReleaseGoals,
    KubernetesDeployGoals,
    SimplifiedKubernetesDeployGoals,
    StagingKubernetesDeployGoals,
} from "./goals";
import { addNodeSupport } from "./nodeSupport";

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Atomist Software Delivery Machine",
        configuration,
    },

        whenPushSatisfies(not(IsNode))
            .itMeans("Non Node repository")
            .setGoals(DoNotSetAnyGoals),

        // Node
        whenPushSatisfies(IsNode, not(MaterialChangeToNodeRepo))
            .itMeans("No Material Change")
            .setGoals(NoGoals),

        whenPushSatisfies(IsNode, HasTravisFile)
            .itMeans("Just Checking")
            .setGoals(CheckGoals),

        // Simplified deployment goalset for automation-client-sdm and k8-automation; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            IsNamed("k8-automation", "atomist-sdm", "clojure-sdm"))
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            IsNamed("sample-sdm"))
            .itMeans("Staging Deploy")
            .setGoals(StagingKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch)
            .itMeans("Docker Release Build")
            .setGoals(DockerReleaseGoals),

        whenPushSatisfies(IsNode, HasDockerfile)
            .itMeans("Docker Build")
            .setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile))
            .itMeans("Build")
            .setGoals(BuildGoals),
    );

    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy);

    sdm.addGoalImplementation("tag", TagGoal,
        executeTag(sdm.configuration.sdm.projectLoader));

    addNodeSupport(sdm);

    summarizeGoalsInGitHubStatus(sdm);

    return sdm;
}
