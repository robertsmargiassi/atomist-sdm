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
