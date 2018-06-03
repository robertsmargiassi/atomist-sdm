import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import * as clj from "@atomist/clj-editors";
import {
    editorAutofixRegistration,
    ExecuteGoalResult,
    RunWithLogContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/dsl/buildDsl";
import {
    DockerBuildGoal,
    VersionGoal,
} from "@atomist/sdm/goal/common/commonGoals";
import { branchFromCommit } from "@atomist/sdm/internal/delivery/build/executeBuild";
import { leinBuilder } from "@atomist/sdm/internal/delivery/build/local/lein/leinBuilder";
import {
    executeVersioner,
    ProjectVersioner,
} from "@atomist/sdm/internal/delivery/build/local/projectVersioner";
import { IsLein } from "@atomist/sdm/mapping/pushtest/jvm/jvmPushTests";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
    executeDockerBuild,
} from "@atomist/sdm/pack/docker/executeDockerBuild";
import { spawnAndWatch } from "@atomist/sdm/util/misc/spawned";
import * as df from "dateformat";
import * as path from "path";

export function addLeinSupport(sdm: SoftwareDeliveryMachine) {

    // TODO cd atomist.sh builder
    sdm.addBuildRules(
        build.when(IsLein)
            .itMeans("Lein build")
            .set(leinBuilder(sdm.configuration.sdm.projectLoader, "lein do clean, dynamodb-local test")),
    );

    sdm.addGoalImplementation("leinVersioner", VersionGoal,
            executeVersioner(sdm.configuration.sdm.projectLoader, LeinProjectVersioner), { pushTest: IsLein })
        .addGoalImplementation("leinDockerBuild", DockerBuildGoal,
            executeDockerBuild(
                sdm.configuration.sdm.projectLoader,
                DefaultDockerImageNameCreator,
                [MetajarPreparation],
                {
                    ...sdm.configuration.sdm.docker.jfrog as DockerOptions,
                    dockerfileFinder: async () => "docker/Dockerfile",
                }), { pushTest: IsLein })
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

export const LeinProjectVersioner: ProjectVersioner = async (status, p) => {
    const file = path.join(p.baseDir, "project.clj");
    const projectVersion = clj.getVersion(file);
    const branch = branchFromCommit(status.commit);
    const branchSuffix = branch !== status.commit.repo.defaultBranch ? `${branch}.` : "";
    const version = `${projectVersion}-${branchSuffix}${df(new Date(), "yyyymmddHHMMss")}`;

    await clj.setVersion(file, version);

    return version;
};
