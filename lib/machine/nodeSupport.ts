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

import { GitHubRepoRef } from "@atomist/automation-client";
import {
    allSatisfied,
    hasFile,
    LogSuppressor,
    not,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { tagRepo } from "@atomist/sdm-core";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
} from "@atomist/sdm-pack-docker";
import {
    executePublish,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmOptions,
    NpmProgressReporter,
    tslintFix,
} from "@atomist/sdm-pack-node";
import {
    npmCompilePreparation,
    npmVersionPreparation,
} from "@atomist/sdm-pack-node/lib/build/npmBuilder";
import { IsMaven } from "@atomist/sdm-pack-spring";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { TypeScriptImports } from "../autofix/imports/importsFix";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import { npmDockerfileFix } from "../autofix/npm/dockerfileFix";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import { NodeModulesProjectListener } from "../support/nodeModulesProjectListener";
import { AutomationClientTagger } from "../support/tagger";
import { RewriteImports } from "../transform/rewriteImports";
import { TryToUpdateAtomistDependencies } from "../transform/tryToUpdateAtomistDependencies";
import { TryToUpdateAtomistPeerDependencies } from "../transform/tryToUpdateAtomistPeerDependencies";
import { UpdatePackageAuthor } from "../transform/updatePackageAuthor";
import { UpdatePackageVersion } from "../transform/updatePackageVersion";
import {
    AutofixGoal,
    BuildGoal,
    DockerBuildGoal,
    ProductionDeploymentGoal,
    ProductionDeploymentWithApprovalGoal,
    PublishGoal,
    PublishWithApprovalGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseVersionGoal,
    SmokeTestGoal,
    StagingDeploymentGoal,
    VersionGoal,
} from "./goals";
import { kubernetesDeploymentData } from "./k8Support";
import {
    DocsReleasePreparations,
    executeReleaseDocs,
    executeReleaseNpm,
    executeReleaseVersion,
    NpmReleasePreparations,
} from "./release";
import { executeSmokeTests } from "./smokeTest";

const NodeDefaultOptions = {
    pushTest: allSatisfied(IsNode, not(IsMaven)),
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
        .with(TypeScriptImports)
        .with(AddThirdPartyLicense)
        .with(npmDockerfileFix("npm", "@atomist/cli"))
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        .withProjectHook(NodeModulesProjectHook);
=======
        .withProjectListener(CachingNodeModulesProjectListener);
>>>>>>> Move to code level project hooks
=======
        .withProjectListener(CachingNodeModulesProjectListener);
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update
>>>>>>> Update
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update

    BuildGoal.with({
            ...NodeDefaultOptions,
            name: "npm-run-build",
<<<<<<< HEAD
<<<<<<< HEAD
            builder: nodeBuilder(sdm, "npm run build"),
            pushTest: allSatisfied(NodeDefaultOptions.pushTest, hasPackageLock),
        })
<<<<<<< HEAD
        .withProjectHook(NodeModulesProjectHook);
=======
            builder: nodeBuilder(sdm,"npm run build"),
=======
            builder: nodeBuilder(sdm, "npm run build"),
>>>>>>> Autofix: tslint
            pushTest: allSatisfied(NodeDefaultOptions.pushTest, hasPackageLock),
        })
<<<<<<< HEAD
        .withProjectListener(CachingNodeModulesProjectListener);
<<<<<<< HEAD
>>>>>>> Move to code level project hooks
=======
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update
>>>>>>> Update
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update

    PublishGoal.with({
            ...NodeDefaultOptions,
            name: "npm-publish",
            goalExecutor: executePublish(
                NodeProjectIdentifier,
                [npmVersionPreparation, npmCompilePreparation],
                sdm.configuration.sdm.npm as NpmOptions,
            ),
        })
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        .withProjectHook(NodeModulesProjectHook);
=======
        .withProjectListener(CachingNodeModulesProjectListener);
>>>>>>> Move to code level project hooks
=======
        .withProjectListener(CachingNodeModulesProjectListener);
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update
>>>>>>> Update
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update

    PublishWithApprovalGoal.with({
            ...NodeDefaultOptions,
            name: "npm-publish",
            goalExecutor: executePublish(
                NodeProjectIdentifier,
                [npmVersionPreparation, npmCompilePreparation],
                sdm.configuration.sdm.npm as NpmOptions,
            ),
        })
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        .withProjectHook(NodeModulesProjectHook);
=======
        .withProjectListener(CachingNodeModulesProjectListener);;
>>>>>>> Move to code level project hooks
=======
=======
>>>>>>> Update
        .withProjectListener(CachingNodeModulesProjectListener);;
=======
        .withProjectHook(NodeModulesProjectHook);
>>>>>>> Autofix: tslint
<<<<<<< HEAD
>>>>>>> Autofix: tslint
=======
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update
>>>>>>> Update
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update

    DockerBuildGoal.with({
            ...NodeDefaultOptions,
            name: "npm-docker-build",
            preparations: [npmVersionPreparation, npmCompilePreparation],
            imageNameCreator: DefaultDockerImageNameCreator,
            options: {
                ...sdm.configuration.sdm.docker.hub as DockerOptions,
                push: true,
            },
        })
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        .withProjectHook(NodeModulesProjectHook);
=======
        .withProjectListener(CachingNodeModulesProjectListener);
>>>>>>> Move to code level project hooks
=======
        .withProjectListener(CachingNodeModulesProjectListener);
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update
>>>>>>> Update
=======
        .withProjectListener(NodeModulesProjectListener);
>>>>>>> Update

    ReleaseNpmGoal.with({
            ...NodeDefaultOptions,
            name: "npm-release",
            goalExecutor: executeReleaseNpm(
                NodeProjectIdentifier,
                NpmReleasePreparations,
                sdm.configuration.sdm.npm as NpmOptions),
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

    StagingDeploymentGoal.withDeployment(kubernetesDeploymentData(sdm));
    ProductionDeploymentGoal.withDeployment(kubernetesDeploymentData(sdm));
    ProductionDeploymentWithApprovalGoal.withDeployment(kubernetesDeploymentData(sdm));

    sdm.addFirstPushListener(tagRepo(AutomationClientTagger));

    sdm.addEvent(deleteDistTagOnBranchDeletion(
        sdm.configuration.sdm.projectLoader,
        sdm.configuration.sdm.npm as NpmOptions));

    sdm.addCodeTransformCommand(TryToUpdateAtomistDependencies)
        .addCodeTransformCommand(UpdatePackageVersion)
        .addCodeTransformCommand(TryToUpdateAtomistPeerDependencies)
        .addCodeTransformCommand(UpdatePackageAuthor)
        .addCodeTransformCommand(RewriteImports);

    return sdm;
}
