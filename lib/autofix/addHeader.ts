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
    Parameter,
    Parameters,
    Project,
    projectUtils,
} from "@atomist/automation-client";
import {
    CodeTransformRegistration,
    ParametersInvocation,
} from "@atomist/sdm";
import * as minimatch from "minimatch";
import { CFamilyLanguageSourceFiles } from "./GlobPatterns";
import { RequestedCommitParameters } from "./RequestedCommitParameters";

/**
 * Default glob pattern matches all C family languages
 */
@Parameters()
export class AddHeaderParameters extends RequestedCommitParameters {

    @Parameter({ required: false })
    public glob: string = CFamilyLanguageSourceFiles;

    @Parameter({ required: false })
    public excludeGlob: string;

    @Parameter({ required: false })
    public license: "apache" = "apache";

    constructor() {
        super("Add missing license headers");
    }

    get header(): string {
        switch (this.license) {
            case "apache":
                return ApacheHeader;
            default:
                throw new Error(`'${this.license}' is not a supported license`);
        }
    }
}

/* tslint:disable */
export const ApacheHeader = `/*
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
 */`;

export const AddApacheLicenseTransform: CodeTransformRegistration<AddHeaderParameters> = {
    transform: addHeaderTransform,
    name: "addHeader",
    paramsMaker: AddHeaderParameters,
    transformPresentation: ahp => ahp.parameters.editMode,
};

export async function addHeaderTransform(p: Project,
                                         ci: ParametersInvocation<AddHeaderParameters>): Promise<Project> {

    let filesWithDifferentHeaders: any[] = [];
    await projectUtils.doWithFiles(p, ci.parameters.glob, async f => {
        if (ci.parameters.excludeGlob && minimatch(f.path, ci.parameters.excludeGlob)) {
            return;
        }
        const content = await f.getContent();
        if (content.includes(ci.parameters.header)) {
            return;
        }
        if (hasDifferentHeader(ci.parameters.header, content)) {
            filesWithDifferentHeaders.push(f);
            return;
        }
        const [prefix, rest] = separatePrefixLines(content);
        await f.setContent(prefix + ci.parameters.header + "\n\n" + rest);
        return;
    });
    return p;
}

/**
 * There are some lines that really need to be at the top.
 * 
 * If a file starts with '#!/executable/to/run', leave that at the top.
 * It's invalid to put a comment before it.
 * @param content 
 */
function separatePrefixLines(content: string): [string, string] {
    if (content.startsWith("#!")) {
        const lines = content.split("\n");
        return [lines[0] + "\n", lines.slice(1).join("\n")]
    }
    return ["", content];
}

export function hasDifferentHeader(header: string, content: string): boolean {
    let checkContent: string = content;
    if (content.startsWith("#!")) {
        checkContent = content.split("\n").slice(1).join("\n");
    }
    if (checkContent.startsWith("/*")) {
        if (checkContent.startsWith(header)
            || checkContent.startsWith("/* tslint:disable */")) {
            // great
            return false;
        }
        return true;
    }
    return false;
}
