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

import * as minimatch from "minimatch";
import * as assert from "power-assert";

import { InMemoryProject } from "@atomist/sdm";
import {
    AddHeaderParameters,
    addHeaderTransform,
    ApacheHeader,
    hasDifferentHeader,
} from "../../lib/autofix/addHeader";

describe("addHeader", () => {

    describe("minimatch", () => {

        it("should match globs like I expect", () => {
            assert(minimatch("src/typings/types.ts", "src/{typings/types,index}.ts"));
            assert(minimatch("src/index.ts", "src/{typings/types,index}.ts"));
            assert(!minimatch("src/typings/types.d.ts", "src/{typings/types,index}.ts"));
            assert(!minimatch("index.ts", "src/{typings/types,index}.ts"));
        });

    });

    describe("hasDifferentHeader", () => {

        it("should find a different header", () => {
            const c = "/*\n * Some header\n */\n";
            assert(hasDifferentHeader(ApacheHeader, c));
        });

        it("should find a different header after #!", () => {
            const c = "#!/use/bin/env node\n/*\n * Some license\n */\n";
            assert(hasDifferentHeader(ApacheHeader, c));
        });

        it("should ignore the same header", () => {
            assert(!hasDifferentHeader(ApacheHeader, ApacheHeader));
        });

        it("should ignore the same header after #!", () => {
            assert(!hasDifferentHeader(ApacheHeader, `#!/usr/bin/env node\n${ApacheHeader}`));
        });

    });

    describe("Allowed pre-header lines", () => {
        it("usually adds the header at the very top of the file", async () => {
            const p = InMemoryProject.of({
                path: "something.ts",
                content: "import stuff from \"stuff\";\n\nconst foo = \"bar\";\n",
            });

            await addHeaderTransform(p, { parameters: new AddHeaderParameters() } as any);

            const newContent = (await p.findFile("something.ts")).getContentSync();

            assert(newContent.startsWith(ApacheHeader));
        });

        it("adds the header after a #! line", async () => {
            const p = InMemoryProject.of({
                path: "something.ts",
                content: "#!/usr/bin/env ts-node;\nimport stuff from \"stuff\";\n\nconst foo = \"bar\";\n",
            });

            await addHeaderTransform(p, { parameters: new AddHeaderParameters() } as any);

            const newContent = (await p.findFile("something.ts")).getContentSync();

            assert(newContent.startsWith("#!/usr/bin/env ts-node;\n" + ApacheHeader));
        });
    });

});
