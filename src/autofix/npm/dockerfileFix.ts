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


import { logger } from "@atomist/automation-client";
import { SuccessIsReturn0ErrorFinder } from "@atomist/automation-client/util/spawned";
import {
    AutofixRegistration,
    hasFile,
} from "@atomist/sdm";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";

/**
 * Change the version of NPM that gets installed into our Docker images
 * @type {{name: string; pushTest: PredicatePushTest; transform: (p) => Promise<Project>}}
 */
export const NpmDockerfileFix: AutofixRegistration = {
    name: "Dockerfile NPM install",
    pushTest: hasFile("Dockerfile"),
    transform: async p => {

        const log = new StringCapturingProgressLog();
        const result = await spawnAndWatch({
                command: "npm",
                args: ["show", "npm", "version"],
            },
            {},
            log,
            {
                errorFinder: SuccessIsReturn0ErrorFinder,
                logCommand: false,
            });

        if (result.code !== 0) {
            return p;
        }

        logger.info(`Updating npm install to version '${log.log.trim()}'`);

        const df = await p.getFile("Dockerfile");
        const dfc = await df.getContent();
        await df.setContent(
            dfc.replace(/npm\s[i|install].*npm@[0-9\.]*/, `npm install -g npm@${log.log.trim()}`));
        return p;
    },
};
