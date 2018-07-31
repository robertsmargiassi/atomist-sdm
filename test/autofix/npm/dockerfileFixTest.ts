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

import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import assert = require("power-assert");
import { npmDockerfileFix } from "../../../src/autofix/npm/dockerfileFix";

const Dockerfile = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install -g npm@6.2.0 \\
    && npm install -g @atomist/cli@0.2.0 \\
    && rm -rf /var/lib/apt/lists/*
`;

describe("dockerfileFix", () => {

    it("should update npm version", async () => {
        const p = InMemoryProject.of(new InMemoryFile("Dockerfile", Dockerfile));
        const rp = await (npmDockerfileFix("npm", "@atomist/cli") as any).transform(p);
        const df = await rp.getFile("Dockerfile");

        assert(await df.getContent() !== Dockerfile);

    }).timeout(1000 * 5);

});
