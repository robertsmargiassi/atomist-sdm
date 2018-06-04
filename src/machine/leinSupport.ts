import { Configuration, logger } from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import * as clj from "@atomist/clj-editors";
import {
    allSatisfied,
    branchFromCommit,
    Builder,
    DefaultDockerImageNameCreator,
    DockerBuildGoal,
    DockerOptions,
    editorAutofixRegistration,
    executeDockerBuild,
    ExecuteGoalResult,
    executeVersioner,
    hasFile,
    IsLein,
    ProjectLoader,
    ProjectVersioner,
    RunWithLogContext,
    SoftwareDeliveryMachine,
    SpawnBuilder,
    VersionGoal,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import { asSpawnCommand, spawnAndWatch } from "@atomist/sdm/util/misc/spawned";
import * as df from "dateformat";
import * as path from "path";

function leinBuilder(projectLoader: ProjectLoader): Builder {
   return new SpawnBuilder(
       {projectLoader,
        options: {
            name: "atomist.sh",
            commands: [asSpawnCommand("./atomist.sh", {})],
            errorFinder: (code, signal, l) => {
                return code !== 0;
            },
            logInterpreter: log => {
                return {
                    // We don't yet know how to interpret clojure logs
                    relevantPart: undefined,
                    message: "lein errors",
                };
            },
            projectToAppInfo: async (p: GitProject) => {
                const projectClj = await p.findFile("project.clj");
                logger.info(`run projectToAppInfo in ${p.baseDir}/${projectClj.path}`);
                return {name: clj.getName(`${p.baseDir}/${projectClj.path}`),
                        version: clj.getVersion(`${p.baseDir}/${projectClj.path}`),
                        id: new GitHubRepoRef("owner", "repo")}; },
            options: {
                env: {
                    ...process.env,
                },
            },
        }});
}

export function addLeinSupport(sdm: SoftwareDeliveryMachine,
                               configuration: Configuration) {

    sdm.addBuildRules(
        build.when(IsLein)
            .itMeans("Lein build")
            .set(leinBuilder(sdm.opts.projectLoader)),
    );

    sdm.addGoalImplementation("leinVersioner", VersionGoal,
            executeVersioner(sdm.opts.projectLoader, LeinProjectVersioner), { pushTest: IsLein })
        .addGoalImplementation("leinDockerBuild", DockerBuildGoal,
            executeDockerBuild(
                sdm.opts.projectLoader,
                DefaultDockerImageNameCreator,
                [MetajarPreparation],
                {
                    ...configuration.sdm.docker.jfrog as DockerOptions,
                    dockerfileFinder: async () => "docker/Dockerfile",
                }), { pushTest: allSatisfied(IsLein, hasFile("docker/Dockerfile")) })
        .addAutofixes(
            editorAutofixRegistration(
              {name: "cljformat",
               editor: async p => {
                    await clj.cljfmt(p.baseDir);
                    return p;
                },
              }));

}

export async function MetajarPreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const result = await spawnAndWatch({
            command: "lein",
            args: ["with-profile", "metajar", "do", "clean,", "metajar"],
        },
        {
            cwd: p.baseDir,
        },
        rwlc.progressLog,
        {
            errorFinder: code => code !== 0,
        });
    return result;
}

export const LeinProjectVersioner: ProjectVersioner = async (status, p, log) => {
    const file = path.join(p.baseDir, "project.clj");
    const projectVersion = clj.getVersion(file);
    const branch = branchFromCommit(status.commit);
    const branchSuffix = branch !== status.commit.repo.defaultBranch ? `${branch}.` : "";
    const version = `${projectVersion}-${branchSuffix}${df(new Date(), "yyyymmddHHMMss")}`;

    await clj.setVersion(file, version);

    return version;
};
