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
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import { SuccessIsReturn0ErrorFinder } from "@atomist/automation-client/util/spawned";
import {
    CodeTransform,
    CodeTransformRegistration,
    GitProject,
} from "@atomist/sdm";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import { TransformModeSuggestion } from "@atomist/sdm/api/command/target/TransformModeSuggestion";
import { makeBuildAware } from "@atomist/sdm/pack/build-aware-transform";

@Parameters()
export class UpdateAtomistDependenciesParameters implements TransformModeSuggestion {

    @Parameter({
        displayName: "Desired NPM dist tag to update to",
        description: "The desired NPM dist tag to update dependencies to",
        pattern: /^.+$/,
        required: false,
    })
    public tag: string = "latest";

    public commitMessage: string = this.desiredPullRequestTitle;

    get desiredBranchName() {
        return `atomist-update-${this.tag}-${Date.now()}`;
    }

    get desiredPullRequestTitle() {
        return `Update @atomist NPM dependencies`;
    }

    get desiredCommitMessage() {
        return this.commitMessage;
    }
}

export const UpdateAtomistDependenciesTransform: CodeTransform<UpdateAtomistDependenciesParameters> =
    async (p, ctx, params) => {
        const tag = params.tag;
        const range = (tag === "latest" ? "^" : "");
        const pjFile = await p.getFile("package.json");
        const pj = JSON.parse(await pjFile.getContent());

        if (pj.dependencies) {
            await updateDependencies(pj.dependencies, tag, range);
        }
        if (pj.devDependencies) {
            await updateDependencies(pj.devDependencies, tag, range);
        }

        await pjFile.setContent(`${JSON.stringify(pj, null, 2)}
`);

        if (!await (p as GitProject).isClean()) {
            await spawnAndWatch({
                    command: "npm",
                    args: ["i"],
                },
                {
                    cwd: (p as GitProject).baseDir,
                    env: {
                        ...process.env,
                        NODE_ENV: "development",
                    },
                },
                new StringCapturingProgressLog(),
                {},
            );
        }

        return p;
    };

async function updateDependencies(deps: any, tag: string, range: string): Promise<void> {
    for (const k in deps) {
        if (deps.hasOwnProperty(k)) {
            if (k.startsWith("@atomist/")) {
                const oldVersion = deps[k];
                const version = `${range}${await latestVersion(`${k}@${tag}`)}`;
                if (version && oldVersion !== version) {
                    deps[k] = version;
                }
            }
        }
    }
}

async function latestVersion(module: string): Promise<string | undefined> {
    const log = new StringCapturingProgressLog();
    const result = await spawnAndWatch({
            command: "npm",
            args: ["show", module, "version"],
        },
        {},
        log,
        {
            errorFinder: SuccessIsReturn0ErrorFinder,
            logCommand: false,
        });

    if (result.code === 0) {
        return log.log.trim();
    }

    return undefined;
}

export const TryToUpdateAtomistDependencies: CodeTransformRegistration<UpdateAtomistDependenciesParameters> = makeBuildAware({
    transform: UpdateAtomistDependenciesTransform,
    paramsMaker: UpdateAtomistDependenciesParameters,
    name: "atomist-dependencies-update",
    description: `Update @atomist NPM dependencies`,
    intent: ["update atomist dependencies", "update deps"],
});
