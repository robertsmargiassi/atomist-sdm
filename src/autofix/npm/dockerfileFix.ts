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
    AutofixRegistration,
    hasFile,
} from "@atomist/sdm";

const NpmVersion = "6.2.0";

export const NpmDockerfileFix: AutofixRegistration = {
    name: "Dockerfile NPM install",
    pushTest: hasFile("Dockerfile"),
    transform: async p => {
        const df = await p.getFile("Dockerfile");
        const dfc = await df.getContent();
        await df.setContent(
            dfc.replace(/npm\s[i|install].*npm@[0-9\.]*/, `npm install -g npm@${NpmVersion}`));
        return p;
    }
}