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

import { spawnAndWatch } from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    StringCapturingProgressLog,
} from "@atomist/sdm";
import { codeBlock } from "@atomist/slack-messages";

export const DiskUsageCommandRegistration: CommandHandlerRegistration = {
    name: "DiskUsageCommandRegistration",
    description: "Returns information about the disk usage of this SDM",
    intent: "disk usage",
    listener: async ci => {

        const log = new StringCapturingProgressLog();
        const result = await spawnAndWatch({
                command: "du",
                args: ["-sha", "-d",  "1"],
            },
            {
                cwd: "/",
            },
            log,
            {},
        );
        await ci.context.messageClient.respond(codeBlock(log.log.trim()));
        return result;
    },
};
