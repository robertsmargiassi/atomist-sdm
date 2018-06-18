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

import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { Project } from "@atomist/automation-client/project/Project";
import {
    AutofixRegistration,
    editorAutofixRegistration,
    PushTest,
} from "@atomist/sdm";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { IsNode } from "@atomist/sdm/mapping/pushtest/node/nodePushTests";
import { spawnAndWatch } from "@atomist/sdm/util/misc/spawned";
import * as lc from "license-checker";
import * as _ from "lodash";
import { promisify } from "util";
import * as fs from "fs-extra";
import * as path from "path";

const LicenseMapping = {
    "Apache 2.0": "Apache-2.0",
};

const LicenseFileName = "legal/THIRD_PARTY.md";

const LicenseTableHeader = `| Name | Version | Publisher | Repository |
|------|---------|-----------|------------|`;

const SummaryTableHadler = `| License | Count |
|---------|-------|`;

export const AddThirdPartyLicense = addThirdPartyLicense(IsNode);

export function addThirdPartyLicense(pushTest: PushTest): AutofixRegistration {
    return editorAutofixRegistration({
        name: "Third party licenses",
        pushTest,
        editor: addThirdPartyLicenseEditor,
    });
}

export async function addThirdPartyLicenseEditor(p: Project): Promise<Project> {
    const cwd = (p as GitProject).baseDir;
    const hasPackageLock = p.getFile("package-lock.json");

    const result = await spawnAndWatch({
           command: "npm",
           args: [(hasPackageLock ? "ci" : "i")],
        },
        {
            cwd,
        },
        new StringCapturingProgressLog(),
        {},
        );

    if (result.code !== 0) {
        return;
    }

    const pj = JSON.parse((await fs.readFile(path.join(cwd, "package.json"))).toString());

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

        licenses.forEach(l => {
            let license = l;
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
        });
    });

    const summary = [];
    const counts = _.mapValues(grouped, l => (l as any).length);
    for (const l in counts) {
        if (counts.hasOwnProperty(l)) {
            summary.push(`|${l}|${counts[l]}|`);
        }
    }

    const details = [];
    // tslint:disable-next-line:no-inferred-empty-object-type
    _.forEach(grouped, (v, k) => {
        const deps = v.map(dep => {
            const ix = dep.name.lastIndexOf("@");
            const name = dep.name.slice(0, ix);
            const version = dep.name.slice(ix + 1);
            return `|\`${name}\`|\`${version}\`|${dep.publisher ? dep.publisher : ""}|[${dep.repository}](${dep.repository})|`
        });
        details.push(`
#### ${k}

${LicenseTableHeader}
${deps.join("\n")}`);
    });

    const content = `# ${pj.name}
    
This page details all runtime OSS dependencies of \`${pj.name}\. 

## Licenses

### Summary

${SummaryTableHadler}
${summary.sort((s1, s2) => s1.localeCompare(s2)).join("\n")}
${details.sort((s1, s2) => s1.localeCompare(s2)).join("\n")}

## Contact

Please send any questions or inquires to [oss@atomist.com](mailto:oss@atomist.com).

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - Development Automation)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
`;

    await p.deleteDirectory("node_modules");
    await p.addFile(LicenseFileName, content);

    return p;
}
