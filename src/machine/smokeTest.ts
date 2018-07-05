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
    ProjectOperationCredentials,
    TokenCredentials,
} from "@atomist/automation-client/operations/common/ProjectOperationCredentials";

import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { ChildProcessResult } from "@atomist/automation-client/util/spawned";
import {
    ExecuteGoal,
    ExecuteGoalResult,
    GoalInvocation,
    ProgressLog,
    ProjectLoader,
} from "@atomist/sdm";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import * as child_process from "child_process";
import { ChildProcess } from "child_process";

const localAtomistAdminPassword = "atomist123";

export interface SdmUnderTest {
    team: string;
    org: string;
    sdm?: RemoteRepoRef;
    port?: number;
    api?: string;
    graphql?: string;
}

export function executeSmokeTests(
    projectLoader: ProjectLoader,
    sdmUnderTest: SdmUnderTest,
    smokeTestRepo: RemoteRepoRef,
    featureName?: string,
): ExecuteGoal {

    return async (gi: GoalInvocation): Promise<ExecuteGoalResult> => {
        const { credentials, context } = gi;
        const id = sdmUnderTest.sdm ? sdmUnderTest.sdm : gi.id;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: false },
            async (project: GitProject) => {

            process.env.NODE_ENV = "development";

            const sdmProcess = startSdm(sdmUnderTest, project.baseDir, gi.progressLog, credentials);

            // how to know when sdm is started? timeout is a hack
            await new Promise<any>(res => setTimeout(res, 10000));

            let testResult;
            try {
                testResult = await runSmokeTests(sdmUnderTest, smokeTestRepo, gi.progressLog, credentials,
                    featureName);
            } catch (e) {
                testResult = {
                    code: 1,
                    message: e.message,
                };
            }

            gi.progressLog.write(`Stopping SDM`);
            flushLog(gi.progressLog);
            sdmProcess.kill();

            const egr: ExecuteGoalResult = {
                code: testResult.code,
                message: testResult.message,
                targetUrl: gi.progressLog.url,
            };
            gi.progressLog.write(`Smoke tests complete: ${egr}`);
            return egr;
        });
    };
}

function startSdm(sdmUnderTest: SdmUnderTest, baseDir: string, progressLog: ProgressLog,
                  credentials: ProjectOperationCredentials): ChildProcess {
    installAndBuild("SDM", progressLog, baseDir);
    const config: {[k: string]: any} = {
        teamIds: [
            sdmUnderTest.team,
        ],
        sdm: {
            rolar: {
                url: "https://rolar.cfapps.io",
            },
            cloudfoundry: {
                user: "pcf@atomist.com",
                password: "covfefe",
                org: "atomist",
                spaces: {
                    staging: "staging",
                    production: "production",
                },
            },
        },
        token: (credentials as TokenCredentials).token,
    };
    if (sdmUnderTest.api || sdmUnderTest.graphql) {
        config.endpoints = {
            api: sdmUnderTest.api,
            graphql: sdmUnderTest.graphql,
        };
    }
    const env: {[k: string]: any} = {
        LOCAL_ATOMIST_ADMIN_PASSWORD: localAtomistAdminPassword,
        GITHUB_TOKEN: (credentials as TokenCredentials).token,
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        ATOMIST_CONFIG: JSON.stringify(config),
    };
    if (sdmUnderTest.port) {
        env.PORT = JSON.stringify(sdmUnderTest.port);
    }

    progressLog.write(`Starting SDM...`);
    flushLog(progressLog);
    const runningSdm = child_process.spawn("node",
        ["node_modules/@atomist/automation-client/start.client.js"],
        {cwd: baseDir, env});
    progressLog.write(`Started SDM with PID=${runningSdm.pid}`);
    flushLog(progressLog);

    runningSdm.stdout.on("data", data => {
        progressLog.write(data.toString());
    });
    runningSdm.stderr.on("data", data => {
        progressLog.write(data.toString());
    });
    runningSdm.on("close", (code: number, signal: string) => { progressLog.write(`close ${code} ${signal}`); });
    runningSdm.on("disconnect", () => { progressLog.write(`disconnect`); });
    runningSdm.on("error", (err: Error) => { progressLog.write(`error ${err.message}`); });
    runningSdm.on("exit", (code: number, signal: string) => { progressLog.write(`exit ${code} ${signal}`); });
    runningSdm.on("message", (message: any, sendHandle) => { progressLog.write(`message ${message} ${sendHandle}`); });
    return runningSdm;
}

async function runSmokeTests(sdmUnderTest: SdmUnderTest, repo: RemoteRepoRef, progressLog: ProgressLog,
                             credentials: ProjectOperationCredentials, featureName: string): Promise<ChildProcessResult> {
    progressLog.write(`Cloning ${repo.owner}:${repo.repo}`);
    flushLog(progressLog);
    const smokeTestProject = await GitCommandGitProject.cloned(credentials, repo);
    progressLog.write(`Cloned ${repo.owner}:${repo.repo} to ${smokeTestProject.baseDir}`);
    installAndBuild("Smoke Tests", progressLog, smokeTestProject.baseDir);

    progressLog.write(`Smoke testing...`);
    process.env.LOCAL_ATOMIST_ADMIN_PASSWORD = localAtomistAdminPassword;
    process.env.GITHUB_TOKEN = (credentials as TokenCredentials).token;
    process.env.ATOMIST_TEAMS = sdmUnderTest.team;
    process.env.SMOKETEST_ORG = sdmUnderTest.org;

    if (sdmUnderTest.port) {
        process.env.SDM_BASE_ENDPOINT = `http://localhost:${sdmUnderTest.port}`;
    }
    if (sdmUnderTest.graphql) {
        process.env.GRAPH_CLIENT_ENDPOINT = sdmUnderTest.graphql;
    }

    let command = "test:cucumber";
    if (featureName) {
        process.env.TEST = featureName;
        command = "test:cucumber:one";
    }

    const result = await spawnAndWatch({
        command: "npm",
        args: [
            "run",
            command,
        ],
    }, { cwd: smokeTestProject.baseDir }, progressLog);
    return result;
}

function flushLog(progressLog: ProgressLog) {
    // tslint:disable-next-line:no-floating-promises
    progressLog.flush();
}

function installAndBuild(targetName: string, progressLog: ProgressLog, baseDir: string) {
    progressLog.write(`Installing ${targetName}...`);
    flushLog(progressLog);
    const npmInstallResult = executeCommandAndBlock(baseDir, `npm ci`);
    progressLog.write(npmInstallResult);

    progressLog.write(`Building ${targetName} ...`);
    flushLog(progressLog);
    const npmBuildResult = executeCommandAndBlock(baseDir, `npm run build`);
    progressLog.write(npmBuildResult);
}

function executeCommandAndBlock(cwd: string, command: string): string {
    return child_process.execSync(command, {cwd, env: process.env}).toString();
}
