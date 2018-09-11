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

import { Success } from "@atomist/automation-client/HandlerResult";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
} from "@atomist/sdm-pack-docker/docker/executeDockerBuild";
import {
    MavenBuilder,
    MavenIncrementPatchCommand,
    MavenProjectVersioner,
    MavenVersionPreparation,
} from "@atomist/sdm-pack-spring";
import { mavenPackage } from "@atomist/sdm-pack-spring/lib/maven/build/MavenBuilder";
import { MavenProjectIdentifier } from "@atomist/sdm-pack-spring/lib/maven/parse/pomParser";
import { IsMaven } from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { ExecuteGoalResult } from "@atomist/sdm/api/goal/ExecuteGoalResult";
import { GoalInvocation } from "@atomist/sdm/api/goal/GoalInvocation";
import { SoftwareDeliveryMachine } from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
import {
    BuildGoal,
    DockerBuildGoal,
    PublishGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseVersionGoal,
    VersionGoal,
} from "./goals";
import { executeReleaseVersion } from "./release";

const MavenDefaultOptions = {
    pushTest: IsMaven,
    logInterpreter: LogSuppressor,
};

/**
 * Add Maven implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addMavenSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    BuildGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-package",
        builder: new MavenBuilder(sdm, [{ name: "skip.npm" }, { name: "skip.webpack" }]),
    });

    VersionGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-versioner",
        versioner: MavenProjectVersioner,

    });

    DockerBuildGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-docker-build",
        preparations: [MavenVersionPreparation, mavenCompilePreparationWithArgs(
            ["skipTests", "skip.npm", "skip.webpack"],
        )],
        imageNameCreator: DefaultDockerImageNameCreator,
        options: sdm.configuration.sdm.docker.hub as DockerOptions,
    });

    ReleaseVersionGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-release-version",
        goalExecutor: executeReleaseVersion(MavenProjectIdentifier, MavenIncrementPatchCommand),
    });

    PublishGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-publish",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    ReleaseDocsGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-docs-release",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    // No need to release npm for a Maven project. Maybe make this a more generic goal.
    ReleaseNpmGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-release",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    return sdm;
}

function mavenCompilePreparationWithArgs(args: string[] = []):
(p: GitProject, goalInvocation: GoalInvocation) => Promise<ExecuteGoalResult> {
    return (p: GitProject, goalInvocation: GoalInvocation) => {
        return mavenPackage(p, goalInvocation.progressLog, args.map(n => {
            return { name: n };
        }));
    };
}
