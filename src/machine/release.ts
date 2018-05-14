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

// tslint:disable:max-file-line-count

import {
    logger,
    Success,
} from "@atomist/automation-client";
import { CommandResult } from "@atomist/automation-client/action/cli/commandLine";
import { configurationValue } from "@atomist/automation-client/configuration";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { TokenCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { NodeFsLocalProject } from "@atomist/automation-client/project/local/NodeFsLocalProject";
import {
    branchFromCommit,
    createTagForStatus,
    DelimitedWriteProgressLogDecorator,
    DockerOptions,
    ExecuteGoalResult,
    ExecuteGoalWithLog,
    NpmOptions,
    PrepareForGoalExecution,
    ProjectIdentifier,
    ProjectLoader,
    readSdmVersion,
    RunWithLogContext,
} from "@atomist/sdm";
import {
    DockerBuildGoal,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import {
    createRelease,
    createStatus,
} from "@atomist/sdm/util/github/ghub";
import { spawnAndWatch } from "@atomist/sdm/util/misc/spawned";
import * as fs from "fs-extra";
import * as path from "path";
import * as uuid from "uuid/v4";

const errorFinder = code => code !== 0;

interface ProjectRegistryInfo {
    registry: string;
    name: string;
    version: string;
}

async function rwlcVersion(rwlc: RunWithLogContext): Promise<string> {
    const commit = rwlc.status.commit;
    const version = await readSdmVersion(
        commit.repo.owner,
        commit.repo.name,
        commit.repo.org.provider.providerId,
        commit.sha,
        branchFromCommit(commit),
        rwlc.context);
    return version;
}

function releaseVersion(version: string): string {
    return version.replace(/-.*/, "");
}

function npmPackageUrl(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}/-/${p.name}-${p.version}.tgz`;
}

function dockerImage(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}:${p.version}`;
}

export async function npmReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const pjFile = await p.getFile("package.json");
    if (!pjFile) {
        const msg = `NPM project does not have a package.json`;
        logger.error(msg);
        return Promise.reject(new Error(msg));
    }
    const pjContents = await pjFile.getContent();
    let pj: { name: string };
    try {
        pj = JSON.parse(pjContents);
    } catch (e) {
        e.message = `Unable to parse package.json '${pjContents}': ${e.message}`;
        logger.error(e.message);
        return Promise.reject(e);
    }
    if (!pj.name) {
        const msg = `Unable to get NPM package name from package.json '${pjContents}'`;
        logger.error(msg);
        return Promise.reject(new Error(msg));
    }
    const version = await rwlcVersion(rwlc);
    const versionRelease = releaseVersion(version);
    const npmOptions = configurationValue<NpmOptions>("sdm.npm");
    if (!npmOptions.registry) {
        return Promise.reject(new Error(`No NPM registry defined in NPM options`));
    }
    const pkgUrl = npmPackageUrl({
        registry: npmOptions.registry,
        name: pj.name,
        version,
    });
    const tmpDir = path.join((process.env.TMPDIR || "/tmp"), `${p.name}-${uuid()}`);
    const tgz = path.join(tmpDir, "package.tgz");
    return spawnAndWatch({
        command: "curl", args: ["--output", tgz, "--silent", "--fail", "--create-dirs", pkgUrl],
    }, {}, rwlc.progressLog, { errorFinder })
        .then(() => spawnAndWatch({
            command: "tar", args: ["-x", "-z", "-f", tgz],
        }, { cwd: tmpDir }, rwlc.progressLog, { errorFinder }))
        .then(() => spawnAndWatch({
            command: "bash", args: ["-c", "rm -r *"],
        }, { cwd: p.baseDir }, rwlc.progressLog, { errorFinder }))
        .then(() => spawnAndWatch({
            command: "cp", args: ["-r", "package/.", p.baseDir],
        }, { cwd: tmpDir }, rwlc.progressLog, { errorFinder }))
        .then(() => spawnAndWatch({
            command: "npm", args: ["--no-git-tag-version", "version", versionRelease],
        }, { cwd: p.baseDir }, rwlc.progressLog, { errorFinder }))
        .then(() => spawnAndWatch({
            command: "rm", args: ["-rf", tmpDir],
        }, {}, rwlc.progressLog, { errorFinder }));
}

export const NpmReleasePreparations: PrepareForGoalExecution[] = [npmReleasePreparation];

export function executeReleaseNpm(
    projectLoader: ProjectLoader,
    projectIdentifier: ProjectIdentifier,
    preparations: PrepareForGoalExecution[] = NpmReleasePreparations,
    options?: NpmOptions,
): ExecuteGoalWithLog {

    if (!options.npmrc) {
        throw new Error(`No npmrc defined in NPM options`);
    }
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            await fs.writeFile(path.join(project.baseDir, ".npmrc"), options.npmrc);

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const result: ExecuteGoalResult = await spawnAndWatch({
                command: "npm",
                args: [
                    "publish",
                    "--registry", options.registry,
                    "--access", (options.access) ? options.access : "restricted",
                ],
            }, { cwd: project.baseDir }, rwlc.progressLog, { errorFinder });

            if (result.code === 0) {
                const pi = await projectIdentifier(project);
                const url = npmPackageUrl({
                    registry: options.registry,
                    name: pi.name,
                    version: pi.version,
                });
                await createStatus(
                    (credentials as TokenCredentials).token,
                    id as GitHubRepoRef,
                    {
                        context: "npm/atomist/package",
                        description: "NPM package",
                        target_url: url,
                        state: "success",
                    });
                result.targetUrl = url;
            }

            return result;
        });
    };
}

export async function dockerReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const version = await rwlcVersion(rwlc);
    const dockerOptions = configurationValue<DockerOptions>("sdm.docker.hub");
    const image = dockerImage({
        registry: dockerOptions.registry,
        name: p.name,
        version,
    });
    return spawnAndWatch({
        command: "docker",
        args: ["login", "--username", dockerOptions.user, "--password", dockerOptions.password],
    }, {}, rwlc.progressLog, { errorFinder })
        .then(() => spawnAndWatch({
            command: "docker", args: ["pull", image],
        }, {}, rwlc.progressLog, { errorFinder }));
}

export const DockerReleasePreparations: PrepareForGoalExecution[] = [dockerReleasePreparation];

export function executeReleaseDocker(
    projectLoader: ProjectLoader,
    preparations: PrepareForGoalExecution[] = DockerReleasePreparations,
    options?: DockerOptions,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        if (!options.registry) {
            throw new Error(`No registry defined in Docker options`);
        }
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const commit = rwlc.status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const image = dockerImage({
                registry: options.registry,
                name: commit.repo.name,
                version,
            });
            const tag = dockerImage({
                registry: options.registry,
                name: commit.repo.name,
                version: versionRelease,
            });

            return spawnAndWatch({
                command: "docker", args: ["tag", image, tag],
            }, {}, rwlc.progressLog, { errorFinder })
                .then(() => spawnAndWatch({
                    command: "docker", args: ["push", tag],
                }, {}, rwlc.progressLog, { errorFinder }))
                .then(() => spawnAndWatch({
                    command: "docker", args: ["rmi", tag],
                }, {}, rwlc.progressLog, { errorFinder }));

        });
    };
}

/**
 * Create release semantic version tag and GitHub release for that tag.
 */
export function executeReleaseTag(projectLoader: ProjectLoader): ExecuteGoalWithLog {
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { status, credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async p => {
            const commit = status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            await createTagForStatus(id, commit.sha, commit.message, versionRelease, credentials);
            const commitTitle = commit.message.replace(/\n[\S\s]*/, "");
            const release = {
                tag_name: versionRelease,
                name: `${versionRelease}: ${commitTitle}`,
            };
            const rrr = p.id as RemoteRepoRef;
            const targetUrl = `${rrr.url}/releases/tag/${versionRelease}`;
            const egr: ExecuteGoalResult = {
                ...Success,
                targetUrl,
            };
            return createRelease((credentials as TokenCredentials).token, id as GitHubRepoRef, release)
                .then(() => egr);
        });
    };
}

function typedocDir(baseDir: string): string {
    return path.join(baseDir, "build", "typedoc");
}

export async function docsReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    return spawnAndWatch(
        { command: "npm", args: ["ci"] },
        { cwd: p.baseDir },
        rwlc.progressLog,
        { errorFinder },
    )
        .then(() => spawnAndWatch(
            { command: "npm", args: ["run", "compile"] },
            { cwd: p.baseDir },
            rwlc.progressLog,
            { errorFinder },
        ))
        .then(() => spawnAndWatch(
            { command: "npm", args: ["run", "typedoc"] },
            { cwd: p.baseDir },
            rwlc.progressLog,
            { errorFinder },
        ))
        .then(() => spawnAndWatch(
            { command: "touch", args: [path.join(typedocDir(p.baseDir), ".nojekyll")] },
            { cwd: p.baseDir },
            rwlc.progressLog,
            { errorFinder },
        ));
}

export const DocsReleasePreparations: PrepareForGoalExecution[] = [docsReleasePreparation];

/**
 * Publish TypeDoc to gh-pages branch.
 */
export function executeReleaseDocs(
    projectLoader: ProjectLoader,
    preparations: PrepareForGoalExecution[] = DocsReleasePreparations,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const commitMsg = `Publishing TypeDoc for version ${versionRelease}`;
            const docDir = typedocDir(project.baseDir);
            const docProject = await NodeFsLocalProject.fromExistingDirectory(project.id, docDir);
            const docGitProject = GitCommandGitProject.fromProject(docProject, credentials) as GitCommandGitProject;
            const targetUrl = `https://${docGitProject.id.owner}.github.io/${docGitProject.id.repo}`;
            const rrr = project.id as RemoteRepoRef;

            return gitCommandGoal(() => docGitProject.init(), rwlc)
                .then(() => gitCommandGoal(() => docGitProject.commit(commitMsg), rwlc))
                .then(() => gitCommandGoal(() => docGitProject.createBranch("gh-pages"), rwlc))
                .then(() => gitCommandGoal(() => docGitProject.setRemote(rrr.cloneUrl(credentials)), rwlc))
                .then(() => gitCommandGoal(() => docGitProject.push({ force: true }), rwlc))
                .then(res => ({ ...res, targetUrl }));
        });
    };
}

/**
 * Increment patch level in package.json version.
 */
export function executeReleaseVersion(
    projectLoader: ProjectLoader,
    projectIdentifier: ProjectIdentifier,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { status, credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async p => {
            const commit = rwlc.status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const pi = await projectIdentifier(p);
            if (pi.version !== versionRelease) {
                const message = `package version (${pi.version}) seems to have already been incremented ` +
                    `after ${releaseVersion} release`;
                console.debug(message);
                const log = new DelimitedWriteProgressLogDecorator(rwlc.progressLog, "\n");
                log.write(`${message}\n`);
                await log.flush();
                await log.close();
                return { ...Success, message };
            }
            const gp = p as GitCommandGitProject;
            return spawnAndWatch(
                { command: "npm", args: ["version", "--no-git-tag-version", "patch"] },
                { cwd: p.baseDir },
                rwlc.progressLog,
                { errorFinder },
            )
                .then(() => gitCommandGoal(() => gp.commit(`Increment version after ${releaseVersion} release`), rwlc))
                .then(() => gitCommandGoal(() => gp.push(), rwlc));
        });
    };
}

async function gitCommandGoal(
    op: () => Promise<CommandResult<GitCommandGitProject>>,
    rwlc: RunWithLogContext,
): Promise<ExecuteGoalResult> {

    const log = new DelimitedWriteProgressLogDecorator(rwlc.progressLog, "\n");
    const res = await op();
    const egr: ExecuteGoalResult = {
        code: res.childProcess.exitCode,
        message: (res.error) ? res.error.message : undefined,
    };
    log.write(res.stdout);
    log.write(res.stderr);
    await log.flush();
    await log.close();
    return egr;
}
