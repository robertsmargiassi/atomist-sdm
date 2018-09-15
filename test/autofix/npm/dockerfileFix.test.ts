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
    InMemoryFile,
    InMemoryProject,
} from "@atomist/automation-client";
import assert = require("power-assert");
import {
    npmDockerfileFix,
    updateNpmInstall,
} from "../../../lib/autofix/npm/dockerfileFix";

const dockerfile = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install -g npm@6.2.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;

describe("dockerfileFix", () => {

    describe("npmDockerfileFix", () => {

        it("should update npm version", async () => {
            const p = InMemoryProject.of(new InMemoryFile("Dockerfile", dockerfile));
            const rp = await (npmDockerfileFix("npm", "@atomist/cli") as any).transform(p);
            const df = await rp.getFile("Dockerfile");

            assert(await df.getContent() !== dockerfile);

        }).timeout(1000 * 10);

    });

    describe("updateNpmInstall", () => {

        it("should update the version to install", () => {
            const c = updateNpmInstall(dockerfile, "npm", "6.3.0");
            const e = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install -g npm@6.3.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            assert(c === e);
        });

        it("should retain options after npm", () => {
            const d = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm -g install npm@6.2.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            const c = updateNpmInstall(d, "npm", "6.3.0");
            const e = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm -g install npm@6.3.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            assert(c === e);
        });

        it("should retain options after install", () => {
            const d = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install --global npm@6.2.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            const c = updateNpmInstall(d, "npm", "6.3.0");
            const e = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install --global npm@6.3.0 \\
    && npm install -g @atomist/cli@0.2.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            assert(c === e);
        });

        it("should retain options after module", () => {
            const c = updateNpmInstall(dockerfile, "@atomist/cli", "0.3.0");
            const e = `FROM ubuntu:17.10

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \\
    && apt-get update \\
    && apt-get install -y nodejs \\
    && npm install -g npm@6.2.0 \\
    && npm install -g @atomist/cli@0.3.0 --unsafe-perm=true --allow-root \\
    && rm -rf /var/lib/apt/lists/*
`;
            assert(c === e);
        });

        it("should maintain current versions", () => {
            const n = updateNpmInstall(dockerfile, "npm", "6.2.0");
            assert(n === dockerfile);
            const c = updateNpmInstall(dockerfile, "@atomist/cli", "0.2.0");
            assert(c === dockerfile);
        });

        it("should do nothing", () => {
            const c = updateNpmInstall(dockerfile, "not-installed", "3.0.0");
            assert(c === dockerfile);
        });

    });

});
