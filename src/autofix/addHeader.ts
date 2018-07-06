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
    HandlerContext,
    logger,
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { Project } from "@atomist/automation-client/project/Project";
import { doWithFiles } from "@atomist/automation-client/project/util/projectUtils";
import { EditorRegistration } from "@atomist/sdm";
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
 */
`;

export const AddApacheLicenseHeaderEditor: EditorRegistration = {
    createEditor: () => addHeaderProjectEditor,
    name: "addHeader",
    paramsMaker: AddHeaderParameters,
    editMode: ahp => ahp.editMode
};

export async function addHeaderProjectEditor(p: Project,
    ctx: HandlerContext,
    params: AddHeaderParameters): Promise<Project> {
    let headersAdded = 0;
    let matchingFiles = 0;
    let filesWithDifferentHeaders = [];
    await doWithFiles(p, params.glob, async f => {
        if (params.excludeGlob && minimatch(f.path, params.excludeGlob)) {
            return;
        }
        ++matchingFiles;
        const content = await f.getContent();
        if (content.includes(params.header)) {
            return;
        }
        if (hasDifferentHeader(params.header, content)) {
            filesWithDifferentHeaders.push(f);
            return;
        }
        ++headersAdded;
        return f.setContent(params.header + "\n\n" + content);
    });
    const sha: string = !!(p as GitProject).gitStatus ? (await (p as GitProject).gitStatus()).sha : p.id.sha;
    logger.info("%d files matched [%s]. %s headers added. %d files skipped", matchingFiles, params.glob, headersAdded, matchingFiles - headersAdded);
    return p;
}

export function hasDifferentHeader(header: string, content: string): boolean {
    let checkContent: string = content;
    if (content.startsWith("#!")) {
        checkContent = content.split("\n").slice(1).join("\n");
    } else {
        checkContent = content;
    }
    if (checkContent.startsWith("/*")) {
        if (checkContent.startsWith(header) || checkContent.startsWith("/* tslint:disable */")) {
            // great
            return false;
        }
        return true;
    }
}
