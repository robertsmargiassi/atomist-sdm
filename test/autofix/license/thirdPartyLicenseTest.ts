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
import { Project } from "@atomist/automation-client/project/Project";
import * as appRoot from "app-root-path";
import { addThirdPartyLicenseEditor } from "../../../src/autofix/license/thirdPartyLicense";

describe("thirdPartyLicense", () => {

    it("should create license file", () => {
        return addThirdPartyLicenseEditor({
            baseDir: appRoot.path,
            addFile: (name, content) => { logger.info(content); },
            getFile: name => true,
            deleteDirectory: () => "",
        } as any as Project);
    }).timeout(1000 * 60);
});
