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
    isLocalProject,
    logger,
    Project,
    ProjectReview,
    ReviewComment,
    safeExec,
} from "@atomist/automation-client";
import {
    CodeInspection,
    CodeInspectionRegistration,
    ReviewListener,
    ReviewListenerInvocation,
    ReviewListenerRegistration,
} from "@atomist/sdm";
import {
    BranchFilter,
    singleIssuePerCategoryManagingReviewListener,
} from "@atomist/sdm-pack-issue";
import * as appRoot from "app-root-path";
import * as path from "path";

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
 * Convert the JSON output of TSLint to proper ReviewComments.  If any
 * part of the process fails, an empty array is returned.
 *
 * @param tslintOutput string output from running `tslint` that will be parsed and converted.
 * @return TSLint errors and warnings as ReviewComments
 */
export function mapTslintResultsToReviewComments(tslintOutput: string, dir: string): ReviewComment[] {
    let results: TslintResults;
    try {
        results = JSON.parse(tslintOutput);
    } catch (e) {
        logger.error(`Failed to parse TSLint output '${tslintOutput}': ${e.message}`);
        return [];
    }

    return results.map(r => {
        const comment: ReviewComment = {
            severity: (r.ruleSeverity === "ERROR") ? "error" : "warn",
            detail: r.failure,
            category: "lint",
            subcategory: "tslint",
            sourceLocation: {
                path: r.name.replace(dir + path.sep, ""),
                offset: r.startPosition.position,
                columnFrom1: r.startPosition.character + 1,
                lineFrom1: r.startPosition.line + 1,
            },
        };
        return comment;
    });
}

/**
 * Run TSLint on a project with a tslint.json file, using the standard
 * version of TSLint and its configuration, i.e., the ones in this
 * project.
 */
export const RunTslintOnProject: CodeInspection<ProjectReview> = async (p: Project) => {
    const review: ProjectReview = { repoId: p.id, comments: [] };
    const tslintJson = "tslint.json";
    const tslintConfigFile = await p.getFile(tslintJson);
    if (!tslintConfigFile) {
        return review;
    }
    const baseDir = appRoot.path;
    const tslintExe = path.join(baseDir, "node_modules", ".bin", "tslint");
    const tslintConfig = path.join(baseDir, tslintJson);

    if (!isLocalProject(p)) {
        logger.error(`Project ${p.name} is not a local project`);
        return review;
    }
    const cwd = p.baseDir;
    logger.debug(`Running ${tslintExe} using ${tslintConfig} on ${p.name} in ${cwd}`);
    const tslintArgs = [
        "--config", tslintConfig,
        "--format", "json",
        "--project", cwd,
        "--force",
    ];
    let output: string;
    try {
        const tslintResult = await safeExec(tslintExe, tslintArgs, { cwd });
        logger.debug(`tslint:stdout:${tslintResult.stdout}`);
        logger.debug(`tslint:stderr:${tslintResult.stderr}`);
        output = tslintResult.stdout;
    } catch (e) {
        logger.error(`Failed to run TSLint: ${e.message}`);
        return review;
    }

    review.comments.push(...mapTslintResultsToReviewComments(output, p.baseDir).slice(0, 20));
    // logger.debug(`tslint:review:${JSON.stringify(review, undefined, 2)}`);

    return review;
};

/**
 * Provide a code inspection that runs TSLint.  If linting reports
 * fails, create an issue.
 */
export const RunTslint: CodeInspectionRegistration<ProjectReview> = {
    name: "Update support files",
    inspection: RunTslintOnProject,
};

/**
 * A review listener that creates a GitHub issue and fails the code
 * inspection review if any reviews exist.
 *
 * @param source Unique identifier for the review
 * @param assignIssue if true, assign created issue to last commit author
 * @param branchFilter only process if this function returns true
 */
function createIssueAndFailGoalReviewListener(source: string, assignIssue: boolean, branchFilter: BranchFilter): ReviewListener {
    return async (ri: ReviewListenerInvocation) => {
        await singleIssuePerCategoryManagingReviewListener(source, assignIssue, branchFilter)(ri);
        if (ri && ri.review && ri.review.comments && ri.review.comments.length > 0) {
            throw new Error(`Review resulted in comments so failing goal`);
        }
    };
}

/**
 * A review listener that fails if there are reviews.
 */
export function createIssueAndFailGoal(
    source: string,
    assign: boolean = true,
    branchFilter: BranchFilter = p => true,
): ReviewListenerRegistration {

    return {
        name: "GitHub Issue Review Listener",
        listener: createIssueAndFailGoalReviewListener(source, assign, branchFilter),
    };
}
