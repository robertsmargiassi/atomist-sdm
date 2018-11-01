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
    logger,
    Project,
} from "@atomist/automation-client";
import {
    AutofixRegistration,
    ToDefaultBranch,
} from "@atomist/sdm";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as path from "path";

/**
 * Update the TypeScript support files in a project.  They are not
 * added if they do not already exist.
 *
 * @param p Project to add files to
 * @return the project
 */
export async function updateSupportFilesInProject(p: Project): Promise<Project> {
    const communityFiles = ["tslint.json"];
    const baseDir = appRoot.path;
    return Promise.all(communityFiles.map(async src => {
        try {
            const destFile = await p.getFile(src);
            if (!destFile) {
                return p;
            }
            const srcPath = path.join(baseDir, src);
            const content = await fs.readFile(srcPath, "utf8");
            await destFile.setContent(content);
        } catch (e) {
            logger.debug(`Failed to update content of ${src} in ${p.name}`);
        }
        return p;
    }))
        .then(() => p);

}

export const UpdateSupportFiles: AutofixRegistration = {
    name: "Update support files",
    pushTest: ToDefaultBranch,
    transform: updateSupportFilesInProject,
};
