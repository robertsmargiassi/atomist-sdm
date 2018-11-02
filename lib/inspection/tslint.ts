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
    NoParameters,
    Project,
    ProjectReview,
    ReviewComment,
    safeExec,
    Severity,
    SourceLocation,
} from "@atomist/automation-client";
import {
    CodeInspection,
    CodeInspectionRegistration,
    PushImpactResponse,
    ReviewListener,
    ReviewListenerRegistration,
} from "@atomist/sdm";
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
 * Return a review comment for a TSLint violation.
 */
function tslintReviewComment(detail: string, severity: Severity = "error", sourceLocation?: SourceLocation): ReviewComment {
    return {
        severity,
        detail,
        category: "lint",
        subcategory: "tslint",
        sourceLocation,
    };
}

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

    const comments = results.map(r => {
        const comment = tslintReviewComment(r.failure, (r.ruleSeverity === "ERROR") ? "error" : "warn", {
            path: r.name.replace(dir + path.sep, ""),
            offset: r.startPosition.position,
            columnFrom1: r.startPosition.character + 1,
            lineFrom1: r.startPosition.line + 1,
        });
        return comment;
    });
    return comments;
}

/**
 * Run TSLint on a project with a tslint.json file, using the standard
 * version of TSLint and its configuration, i.e., the ones in this
 * project.  At most 20 TSLint violations are returned, since they are
 * used to create a GitHub issue and if the body of that POST is too
 * large, it is rejected.
 */
export const RunTslintOnProject: CodeInspection<ProjectReview, NoParameters> = async (p: Project) => {
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
    try {
        const tslintResult = await safeExec(tslintExe, tslintArgs, { cwd });
        if (tslintResult.stderr) {
            logger.debug(`TSLint standard error: ${tslintResult.stderr}`);
        }
        const comments = mapTslintResultsToReviewComments(tslintResult.stdout, p.baseDir);
        const maxComments = 20;
        if (comments.length > maxComments) {
            const remove = comments.length - maxComments;
            const more = tslintReviewComment(`${remove} additional errors and/or warnings were omitted from this report`);
            comments.splice(maxComments, remove, more);
        }
        review.comments.push(...comments);
    } catch (e) {
        logger.error(`Failed to run TSLint: ${e.message}`);
    }

    return review;
};

/**
 * Provide a code inspection that runs TSLint and returns a
 * ProjectReview.
 */
export const RunTslint: CodeInspectionRegistration<ProjectReview> = {
    name: "Run TSLint on project",
    inspection: RunTslintOnProject,
};

/**
 * Listener that fails the code inspection if the review has any
 * comments.
 */
const failGoalsIfCommentsReviewListener: ReviewListener = async rli => {
    if (rli && rli.review && rli.review.comments && rli.review.comments.length > 0) {
        logger.debug(`Failing auto code inspection due to existing review comments`);
        return PushImpactResponse.failGoals;
    }
    return PushImpactResponse.proceed;
};

export const FailGoalsIfComments: ReviewListenerRegistration = {
    name: "Fail Goals if any code inspections result in comments",
    listener: failGoalsIfCommentsReviewListener,
};
