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
import {
    PushTest,
    pushTest,
} from "@atomist/sdm";
import * as sprintf from "sprintf-js";

export function IsNamed(...names: string[]): PushTest {
    return pushTest(sprintf("Project name is one of these: %s", names), async pci => {
        if (names.includes(pci.project.name)) {
            logger.info("True: Project %s (in repo %s) in my list of names, which is %s", pci.project.name, pci.id.repo, names);
            return true;
        } else {
            logger.info("False: Project %s (in repo %s) is not in my list of names, which is %s", pci.project.name, pci.id.repo, names);
            return false;
        }
    });
}

export function IsTeam(...teams: string[]): PushTest {
    return pushTest("Atomist team checks", async pci => {
        return teams.includes(pci.context.teamId);
    });
}
