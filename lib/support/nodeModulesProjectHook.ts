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
    ChildProcessResult,
    GitProject,
    spawnAndWatch,
    SuccessIsReturn0ErrorFinder,
} from "@atomist/automation-client";
import {
    ExecuteGoalResult,
    GoalInvocation,
    GoalProjectHook,
    GoalProjectHookPhase,
} from "@atomist/sdm";
import * as fs from "fs-extra";
import * as _ from "lodash";

export const NodeModulesProjectHook: GoalProjectHook = async (p, gi, phase) => {
    // Check if project has a package.json
    if (!(await p.hasFile("package.json"))) {
        return;
    }

    if (phase === GoalProjectHookPhase.pre) {
        return cacheNodeModules(p, gi);
    }
};

async function cacheNodeModules(p: GitProject, gi: GoalInvocation): Promise<void | ExecuteGoalResult> {
    // If project already has a node_modules dir; there is nothing left to do
    if (await p.hasDirectory("node_modules")) {
        return;
    }

    let requiresInstall = true;
    let installed = false;

    // Check cache for a previously cached node_modules cache archive
    const cacheFileName = `${_.get(gi, "configuration.sdm.cache.enable",
        "/opt/data")}/${gi.sdmGoal.goalSetId}-node_modules.tar.gz`;
    if (_.get(gi, "configuration.sdm.cache.enabled") === true && (await fs.pathExists(cacheFileName))) {
        const result = await extract(cacheFileName, p, gi);
        requiresInstall = result.code !== 0;
    }

    if (requiresInstall) {
        let result;
        if (await p.hasFile("package-lock.json")) {
            result = await runInstall("ci", p, gi);
        } else {
            result = await runInstall("i", p, gi);
        }
        installed = result.code === 0;
    }

    // Cache the node_modules folder
    if (installed && _.get(gi, "configuration.sdm.cache.enabled") === true) {
        const tempCacheFileName = `${cacheFileName}.${process.pid}`;
        const result = await compress(tempCacheFileName, p, gi);
        if (result.code === 0) {
            await fs.move(tempCacheFileName, cacheFileName, { overwrite: true });
        }
    }
}

async function runInstall(cmd: string,
                          p: GitProject,
                          gi: GoalInvocation): Promise<ChildProcessResult> {
    return spawnAndWatch(
        {
            command: "npm",
            args: [cmd],
        },
        {
            cwd: p.baseDir,
            env: {
                ...process.env,
                NODE_ENV: "development",
            },
        },
        gi.progressLog,
        {
            errorFinder: SuccessIsReturn0ErrorFinder,
        });
}

async function compress(name: string,
                        p: GitProject,
                        gi: GoalInvocation): Promise<ChildProcessResult> {
    return spawnAndWatch(
        {
            command: "tar",
            args: ["-zcf", name, "node_modules"],
        },
        {
            cwd: p.baseDir,
        },
        gi.progressLog,
        {
            errorFinder: SuccessIsReturn0ErrorFinder,
        });
}

async function extract(name: string,
                       p: GitProject,
                       gi: GoalInvocation): Promise<ChildProcessResult> {
    return spawnAndWatch(
        {
            command: "tar",
            args: ["-xf", name],
        },
        {
            cwd: p.baseDir,
        },
        gi.progressLog,
        {
            errorFinder: SuccessIsReturn0ErrorFinder,
        });
}
