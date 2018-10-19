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
import {
    PushListenerInvocation,
} from "@atomist/sdm";
import * as appRoot from "app-root-path";
import * as path from "path";
import * as assert from "power-assert";
import {
    fileSha256,
    HasHomebrewFormula,
} from "../../lib/machine/homebrewSupport";

describe("homebrewSupport", () => {

    describe("HasHomeBrewFormula", () => {

        it("should not find a formula in an empty project", async () => {
            const p = InMemoryProject.of();
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(!r);
        });

        it("should not find a formula in a project without one", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: "README.md", content: "# Nothing to see here\n" },
                { path: "src/stuff.rb", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(!r);
        });

        it("should find a formula", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: ".atomist/homebrew/cli.rb", content: "# Nothing to see here\n" },
                { path: "README.md", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(r);
        });

        it("should return true if multiple formula exist", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: ".atomist/homebrew/cli.rb", content: "# Nothing to see here\n" },
                { path: "README.md", content: "# Nothing to see here\n" },
                { path: "src/stuff.rb", content: "# Nothing to see here\n" },
                { path: ".atomist/homebrew/other.rb", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(r);
        });

    });

    describe("fileSha256", () => {

        it("should compute the proper hash", async () => {
            const sha = await fileSha256(path.join(appRoot.path, "LICENSE"));
            const e = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
            assert(sha === e);
        });

    });

});
