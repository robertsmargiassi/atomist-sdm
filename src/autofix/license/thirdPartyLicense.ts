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

import { HandlerContext } from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { Project } from "@atomist/automation-client/project/Project";
import {
    AutofixRegistration,
    editorAutofixRegistration,
    PushTest,
} from "@atomist/sdm";
import { IsNode } from "@atomist/sdm/mapping/pushtest/node/nodePushTests";
import * as lc from "license-checker";
import * as _ from "lodash";
import { promisify } from "util";

const LicenseMapping = {
    "Apache 2.0": "Apache-2.0",
};

const LicenseFileName = "legal/THIRD_PARTY.md";

export const AddThirdPartyLicense = addThirdPartyLicense(IsNode);

export function addThirdPartyLicense(pushTest: PushTest): AutofixRegistration {
    return editorAutofixRegistration({
        name,
        pushTest,
        editor: addThirdPartyLicenseEditor,
    });
}

export async function addThirdPartyLicenseEditor(p: Project): Promise<Project> {
    const cwd = (p as GitProject).baseDir;
    const json = await promisify(lc.init)({
            start: cwd,
            production: true,
        });

    const grouped = {};
    _.forEach(json, (v, k) => {
        let licenses = v.licenses;

        if (!Array.isArray(licenses)) {
            licenses = [licenses];
        }

        licenses.forEach(license => {
            if (license.endsWith("*")) {
                license = license.slice(0, -1);
            }

            if (license.startsWith("(") && license.endsWith(")")) {
                license = license.slice(1, -1);
            }

            if (LicenseMapping.hasOwnProperty(license)) {
                license = LicenseMapping[license];
            }

            if (grouped.hasOwnProperty(license)) {
                grouped[license] = [...grouped[license], {
                    ...v,
                    name: k,
                }];
            } else {
                grouped[license] = [{
                    ...v,
                    name: k,
                }];
            }
        })
    });

    const summary = [];
    const counts = _.mapValues(grouped, l => (l as any).length);
    for(const l in counts) {
        summary.push(`  * ${l} ${counts[l]}`);
    }

    const details = [];
    _.forEach(grouped, (v, k) => {
        const deps = v.map(dep => `  * _${dep.name}_${dep.publisher ? ` ${dep.publisher} ` : " "}[${dep.repository}](${dep.repository})`);
        details.push(`
#### ${k}

${deps.join("\n")}`)
    })

    const content = `### Licenses
    
#### Summary

${summary.sort((s1, s2) => s1.localeCompare(s2)).join("\n")}
${details.sort((s1, s2) => s1.localeCompare(s2)).join("\n")}

### Contact

Please send any questions to [oss@atomist.com](mailto:oss@atomist.com).`

    await p.addFile(LicenseFileName, content);

    return p;
}