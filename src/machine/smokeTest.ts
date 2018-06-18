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


import {GitHubRepoRef} from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {
    ProjectOperationCredentials,
    TokenCredentials,
} from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {
    ExecuteGoalResult, ExecuteGoalWithLog, ProgressLog, ProjectLoader, RunWithLogContext,
} from "@atomist/sdm";
import {createStatus} from "@atomist/sdm/util/github/ghub";
import {ChildProcessResult, spawnAndWatch} from "@atomist/sdm/util/misc/spawned";

import {RemoteRepoRef} from "@atomist/automation-client/operations/common/RepoId";
import {GitCommandGitProject} from "@atomist/automation-client/project/git/GitCommandGitProject";
import * as child_process from "child_process";
import {ChildProcess} from "child_process";

const localAtomistAdminPassword = "atomist123";

export interface SmokeTestTarget {
    team: string;
    org: string;
}

export function executeSmokeTests(
    projectLoader: ProjectLoader,
    smokeTestTarget: SmokeTestTarget,
    smokeTestRepo: RemoteRepoRef,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: false },
            async (project: GitProject) => {

            const sdmProcess = startSdm(project.baseDir, rwlc.progressLog);

            // how to know when sdm is started? timeout is a hack
            await new Promise<any>(res => setTimeout(res, 10000));

            const testResult = await runSmokeTests(smokeTestTarget, smokeTestRepo, rwlc.progressLog, credentials);

            rwlc.progressLog.write(`Stopping SDM`);
            flushLog(rwlc.progressLog);
            sdmProcess.kill();

            if (id.sha) {
                await createStatus(
                    (credentials as TokenCredentials).token,
                    id as GitHubRepoRef,
                    {
                        context: "npm/atomist/smoketest",
                        description: "smokeTest",
                        target_url: rwlc.progressLog.url,
                        state: testResult.error ? "failure" : "success",
                    });
            }

            const egr: ExecuteGoalResult = {
                code: testResult.code,
                message: testResult.message,
                targetUrl: rwlc.progressLog.url,
            };
            rwlc.progressLog.write(`Smoke tests comple: ${egr}`);
            return egr;
        });
    };
}

function startSdm(baseDir: string, progressLog: ProgressLog): ChildProcess {
    installAndBuild("SDM", progressLog, baseDir);
    process.env.LOCAL_ATOMIST_ADMIN_PASSWORD = localAtomistAdminPassword;
    progressLog.write(`Starting SDM...`);
    flushLog(progressLog);
    const runningSdm = child_process.spawn("node",
        ["node_modules/@atomist/automation-client/start.client.js"],
        {cwd: baseDir, env: process.env});
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

async function runSmokeTests(target: SmokeTestTarget, repo: RemoteRepoRef, progressLog: ProgressLog,
                             credentials: ProjectOperationCredentials): Promise<ChildProcessResult> {
    progressLog.write(`Cloning ${repo.owner}:${repo.repo}`);
    flushLog(progressLog);
    const smokeTestProject = await GitCommandGitProject.cloned(credentials, repo);
    progressLog.write(`Cloned ${repo.owner}:${repo.repo} to ${smokeTestProject.baseDir}`);
    installAndBuild("Smoke Tests", progressLog, smokeTestProject.baseDir);

    progressLog.write(`Smoke testing...`);
    process.env.LOCAL_ATOMIST_ADMIN_PASSWORD = localAtomistAdminPassword;
    process.env.GITHUB_TOKEN = (credentials as TokenCredentials).token;
    process.env.ATOMIST_TEAMS = target.team;
    process.env.SMOKETEST_ORG = target.org;

    const result = await spawnAndWatch({
        command: "npm",
        args: [
            "run",
            "test:cucumber",
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
    const npmInstallResult = executeCommandAndBlock(baseDir, `npm i`);
    progressLog.write(npmInstallResult);

    progressLog.write(`Building ${targetName} ...`);
    flushLog(progressLog);
    const npmBuildResult = executeCommandAndBlock(baseDir, `npm run build`);
    progressLog.write(npmBuildResult);
}

function executeCommandAndBlock(cwd: string, command: string): string {
    return child_process.execSync(command, {cwd, env: process.env}).toString();
}