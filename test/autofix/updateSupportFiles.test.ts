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
    InMemoryProject,
} from "@atomist/automation-client";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as path from "path";
import * as assert from "power-assert";
import {
    updateSupportFilesInProject,
} from "../../lib/autofix/updateSupportFiles";

describe("updateSupportFilesInProject", () => {

    let tslintContent: string;
    before(async () => {
        tslintContent = await fs.readFile(path.join(appRoot.path, "tslint.json"), "utf8");
    });

    it("should not add the files to an empty project", async () => {
        const p = InMemoryProject.of();
        await updateSupportFilesInProject(p);
        assert(!p.fileExistsSync("tslint.json"));
    });

    it("should update the files in a project", async () => {
        const p = InMemoryProject.of(
            { path: "tslint.json", content: "{}\n" },
        );
        await updateSupportFilesInProject(p);
        assert(p.fileExistsSync("tslint.json"));
        const f = await p.getFile("tslint.json");
        const c = await f.getContent();
        assert(c === tslintContent);
    });

    it("should effectively do nothing", async () => {
        const p = InMemoryProject.of(
            { path: "tslint.json", content: tslintContent },
        );
        await updateSupportFilesInProject(p);
        assert(p.fileExistsSync("tslint.json"));
        const f = await p.getFile("tslint.json");
        const c = await f.getContent();
        assert(c === tslintContent);
    });

});
