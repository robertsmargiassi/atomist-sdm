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
    HandlerContext,
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import { SuccessIsReturn0ErrorFinder } from "@atomist/automation-client/util/spawned";
import {
    CodeTransform,
    CodeTransformRegistration,
    EditMode,
    GitProject,
} from "@atomist/sdm";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import { DryRunMessage } from "@atomist/sdm/pack/build-aware-transform/support/makeBuildAware";
import { codeLine } from "@atomist/slack-messages";

@Parameters()
export class UpdateAtomistDependenciesParameters {

    @Parameter({
        displayName: "Desired NPM dist tag to update to",
        description: "The desired NPM dist tag to update dependencies to",
        pattern: /^.+$/,
        required: false,
    })
    public tag: string = "latest";

    public commitMessage: string;

}

export const UpdateAtomistDependenciesTransform: CodeTransform<UpdateAtomistDependenciesParameters> =
    async (p, ctx, params) => {
        const tag = params.tag;
        const range = (tag === "latest" ? "^" : "");
        const pjFile = await p.getFile("package.json");
        const pj = JSON.parse(await pjFile.getContent());
        const versions = [];

        await ctx.messageClient.respond(`Updating @atomist NPM dependencies of ${codeLine(pj.name)}`);

        if (pj.dependencies) {
            await updateDependencies(pj.dependencies, tag, range, versions, ctx);
        }
        if (pj.devDependencies) {
            await updateDependencies(pj.devDependencies, tag, range, versions, ctx);
        }

        await pjFile.setContent(`${JSON.stringify(pj, null, 2)}
`);

        if (!(await (p as GitProject).isClean()).success) {
            await ctx.messageClient.respond(`Versions updated. Running ${codeLine("npm install")}`);
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

        params.commitMessage = `Update @atomist NPM dependencies to tag ${params.tag}

${versions.join("\n")}

${DryRunMessage}`;

        return p;
    };

async function updateDependencies(deps: any,
                                  tag: string,
                                  range: string,
                                  versions: string[],
                                  ctx: HandlerContext): Promise<void> {
    for (const k in deps) {
        if (deps.hasOwnProperty(k)) {
            if (k.startsWith("@atomist/")) {
                const oldVersion = deps[k];
                const version = `${range}${await latestVersion(`${k}@${tag}`)}`;
                if (version && oldVersion !== version) {
                    deps[k] = version;
                    versions.push(`${k} ${oldVersion} > ${version}`);
                    await ctx.messageClient.respond(`Updated ${codeLine(k)} from ${codeLine(oldVersion)} to ${codeLine(version)}`);
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

export const TryToUpdateAtomistDependencies: CodeTransformRegistration<UpdateAtomistDependenciesParameters> = {
    transform: UpdateAtomistDependenciesTransform,
    paramsMaker: UpdateAtomistDependenciesParameters,
    name: "UpdateAtomistDependencies",
    description: `Update @atomist NPM dependencies`,
    intent: ["update atomist dependencies", "update deps"],
    transformPresentation: ci => {
        return new BranchCommit(ci.parameters);
    },
};

class BranchCommit implements EditMode {

    constructor(private readonly params: UpdateAtomistDependenciesParameters) {}

    get message(): string {
        return this.params.commitMessage || "Update @atomist NPM dependencies";
    }

    get branch(): string {
        return `atomist-update-${this.params.tag}-${Date.now()}`;
    }
}
