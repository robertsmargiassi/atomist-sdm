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

import { SimpleProjectEditor } from "@atomist/automation-client/operations/edit/projectEditor";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { Project } from "@atomist/automation-client/project/Project";
import {
    allSatisfied,
    PushTest,
    ToDefaultBranch,
} from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import { AutofixRegistration } from "@atomist/sdm/api/registration/AutofixRegistration";
import * as fs from "fs-extra";
import * as lc from "license-checker";
import * as _ from "lodash";
import * as path from "path";
import * as spdx from "spdx-license-list";
import { promisify } from "util";

const LicenseMapping = {
    "Apache 2.0": "Apache-2.0",
};

const LicenseFileName = "legal/THIRD_PARTY.md";
const GitattributesFileName = ".gitattributes";

const LicenseTableHeader = `| Name | Version | Publisher | Repository |
|------|---------|-----------|------------|`;

const SummaryTableHadler = `| License | Count |
|---------|-------|`;

export const AddThirdPartyLicense = addThirdPartyLicense(allSatisfied(IsNode, ToDefaultBranch));

export function addThirdPartyLicense(pushTest: PushTest): AutofixRegistration {
    return {
        name: "Third party licenses",
        pushTest,
        transform: addThirdPartyLicenseTransform(true),
    };
}

export function addThirdPartyLicenseTransform(runInstall: boolean = true): SimpleProjectEditor {
    return async p => {
        const cwd = (p as GitProject).baseDir;
        const hasPackageLock = p.getFile("package-lock.json");

        if (runInstall) {
            const result = await
                spawnAndWatch({
                        command: "npm",
                        args: [(hasPackageLock ? "ci" : "i")],
                    },
                    {
                        cwd,
                        env: {
                            ...process.env,
                            NODE_ENV: "development",
                        },
                    },
                    new StringCapturingProgressLog(),
                    {},
                );

            if (result.code !== 0) {
                return p;
            }
        }

        const pj = JSON.parse((await fs.readFile(path.join(cwd, "package.json"))).toString());
        const ownModule = `${pj.name}@${pj.version}`;

        const json = await
            promisify(lc.init)({
                start: cwd,
                production: true,
            });

        const grouped = {};
        _.forEach(json, (v, k) => {
            if (k === ownModule) {
                return;
            }

            let licenses = v.licenses;

            if (!Array.isArray(licenses)) {
                if (licenses.endsWith("*")) {
                    licenses = licenses.slice(0, -1);
                }

                if (licenses.startsWith("(") && licenses.endsWith(")")) {
                    licenses = licenses.slice(1, -1);
                }
                licenses = [...(licenses as string).split(" OR ")];
            }

            licenses.forEach(l => {
                let license = l;

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
                const anchor = l.toLocaleLowerCase()
                    .replace(/ /g, "-")
                    .replace(/\./g, "")
                    .replace(/:/g, "")
                    .replace(/\//g, "");
                summary.push(`|[${l}](#${anchor})|${counts[l]}|`);
            }
        }

        const details = [];
        // tslint:disable-next-line:no-inferred-empty-object-type
        _.forEach(grouped, (v: any, k) => {
            const deps = v.map(dep => {
                const ix = dep.name.lastIndexOf("@");
                const name = dep.name.slice(0, ix);
                const version = dep.name.slice(ix + 1);
                return `|\`${name}\`|\`${version}\`|${dep.publisher ? dep.publisher : ""}|${
                    dep.repository ? `[${dep.repository}](${dep.repository})` : ""}|`;
            });
            let ld = "";

            if (spdx[k]) {
                ld = `${spdx[k].name} - [${spdx[k].url}](${spdx[k].url})\n`;
            }

            details.push(`
#### ${k}
${ld}
${LicenseTableHeader}
${deps.join("\n")}`);
        });

        const content = `# ${pj.name}

This page details all runtime OSS dependencies of \`${pj.name}\`.

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

        await addGitattribute(p);
        await p.deleteDirectory("node_modules");
        await p.addFile(LicenseFileName, content);

        return p;
    };
}

async function addGitattribute(p: Project): Promise<void> {
    const attribute = `${LicenseFileName} linguist-generated=true
`;
    const ga = await p.getFile(GitattributesFileName);
    if (ga) {
        let c = await ga.getContent();
        if (!c.includes(LicenseFileName)) {
            c += `
${attribute}`;
            await ga.setContent(c);
        }
    } else {
        await p.addFile(GitattributesFileName, attribute);
    }
}
