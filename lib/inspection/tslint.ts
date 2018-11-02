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
    logger,
    Project,
    safeExec,
} from "@atomist/automation-client";
import {
    CodeInspection,
    CodeInspectionRegistration,
} from "@atomist/sdm";
import * as appRoot from "app-root-path";
import * as path from "path";
import * as process from "process";

export interface TslintPosition {
    character: number;
    line: number;
    position: number;
}

export interface TslintFix {
    innerStart: number;
    innerLength: number;
    innerText: string;
}

/**
 * Manually created interface representing the JSON output of the
 * tslint command-line utility.
 */
export interface TslintResult {
    endPosition: TslintPosition;
    failure: string;
    fix: TslintFix | TslintFix[];
    name: string;
    ruleName: string;
    ruleSeverity: "ERROR" | "WARNING";
    startPosition: TslintPosition;
}

export type TslintResults = TslintResult[];

/**
 * Run TSLint on a project with a tslint.json file, using the standard
 * version of TSLint and its configuration, i.e., the ones in this
 * project.
 */
export const RunTslintOnProject: CodeInspection<TslintResults> = async (p: Project) => {
    const tslintJson = "tslint.json";
    const tslintConfigFile = await p.getFile(tslintJson);
    if (!tslintConfigFile) {
        return [];
    }
    const baseDir = appRoot.path;
    const tslintExe = path.join(baseDir, "node_modules", ".bin", "tslint");
    const tslintConfig = path.join(baseDir, tslintJson);
    logger.debug(`Running ${tslintExe} using ${tslintConfig} on ${p.name} in ${process.cwd}`);
    const tslintArgs = [
        "--config", tslintConfig,
        "--format", "json",
        "--project", ".",
        "**/*.ts",
    ];
    let output: string;
    try {
        const tslintResult = await safeExec(tslintExe, tslintArgs);
        // if there are only warning violations, exit status is zero and we end up here
        output = tslintResult.stdout;
    } catch (e) {
        if (e.code && e.stdout) {
            // if there are error violations, we end up here
            output = e.stdout;
        } else {
            // if something else went wrong, we end up here
            logger.error(`Failed to run TSLint: ${e.message}`);
            return [];
        }
    }

    try {
        const results: TslintResults = JSON.parse(output);
        return results;
    } catch (e) {
        logger.error(`Failed to parse TSLint output '${output}': ${e.message}`);
    }

    return [];
};

/**
 * Provide a code inspection that runs TSLint.  If linting reports
 * fails, create an issue.
 */
export const RunTslint: CodeInspectionRegistration<TslintResults> = {
    name: "Update support files",
    inspection: RunTslintOnProject,
};
