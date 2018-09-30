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
    doWithAllMatches,
    doWithFiles,
    TypeScriptES6FileParser,
} from "@atomist/automation-client";
import {
    AutofixRegistration,
    CodeTransform,
    CodeTransformRegistration,
} from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";

/**
 * CodeTransform that renames tests
 */
const RenameTestsTransform: CodeTransform = async project => {
    await doWithAllMatches(project, TypeScriptES6FileParser,
        "test/**/*.ts",
        "//ImportDeclaration//StringLiteral",
        m => {
            if (!m.$value.includes("/src")) {
                m.$value = m.$value.replace(/Test$/, ".test");
            }
        });
    return doWithFiles(project, "test/**/*.ts", async f => {
        return f.setPath(f.path.replace(/Test\.ts$/, ".test.ts"));
    });
};

export const RenameTestFix: AutofixRegistration = {
    name: "TypeScript tests",
    pushTest: IsNode,
    transform: RenameTestsTransform,
};

export const RenameTest: CodeTransformRegistration = {
    name: "RenameTest",
    intent: "rename tests",
    transform: RenameTestsTransform,
}