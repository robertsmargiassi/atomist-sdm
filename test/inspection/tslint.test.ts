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
} from "@atomist/automation-client";
import {
    PushImpactResponse,
    ReviewListenerInvocation,
} from "@atomist/sdm";
import * as path from "path";
import * as assert from "power-assert";
import {
    failGoalsIfErrorCommentsReviewListener,
    mapTslintResultsToReviewComments,
} from "../../lib/inspection/tslint";

describe("tslint", () => {

    describe("mapTslintResultsToReviewComments", () => {

        let loggerError: any;
        let errorMessage: string;
        before(() => {
            loggerError = logger.error;
            logger.error = (message?: any, ...optionalParams: any[]) => {
                errorMessage = message;
                return logger;
            };
        });
        after(() => {
            logger.error = loggerError;
        });

        it("should handle an empty array", () => {
            errorMessage = undefined;
            const c = mapTslintResultsToReviewComments("[]", "");
            assert(c.length === 0);
            assert(!errorMessage);
        });

        it("should properly parse TSLint JSON output", () => {
            errorMessage = undefined;
            const d = "/some/path/to/something";
            // tslint:disable-next-line:max-line-length
            const o = `[{"endPosition":{"character":191,"line":1,"position":205},"failure":"Exceeds maximum line length of 150","name":"${d}${path.sep}test/inspection/tslint.test.ts","ruleName":"max-line-length","ruleSeverity":"WARNING","startPosition":{"character":0,"line":1,"position":14}},{"endPosition":{"character":11,"line":1,"position":25},"failure":"Calls to 'console.log' are not allowed.","name":"${d}${path.sep}lib/inspection/tslint.ts","ruleName":"no-console","ruleSeverity":"WARNING","startPosition":{"character":0,"line":1,"position":14}},{"endPosition":{"character":13,"line":0,"position":13},"failure":"Missing semicolon","fix":{"innerStart":13,"innerLength":0,"innerText":";"},"name":"${d}${path.sep}lib/inspection/tslint.ts","ruleName":"semicolon","ruleSeverity":"ERROR","startPosition":{"character":13,"line":0,"position":13}}]`;
            const c = mapTslintResultsToReviewComments(o, d);
            assert(c.length === 3);
            assert(!errorMessage);
            c.forEach(r => {
                assert(r.category === "lint");
                assert(r.subcategory === "tslint");
            });
            assert(c[0].detail === "Exceeds maximum line length of 150");
            assert(c[0].severity === "warn");
            assert(c[0].sourceLocation.path === "test/inspection/tslint.test.ts");
            assert(c[0].sourceLocation.columnFrom1 === 1);
            assert(c[0].sourceLocation.lineFrom1 === 2);
            assert(c[0].sourceLocation.offset === 14);
            assert(c[1].detail === "Calls to 'console.log' are not allowed.");
            assert(c[1].severity === "warn");
            assert(c[1].sourceLocation.path === "lib/inspection/tslint.ts");
            assert(c[1].sourceLocation.columnFrom1 === 1);
            assert(c[1].sourceLocation.lineFrom1 === 2);
            assert(c[1].sourceLocation.offset === 14);
            assert(c[2].detail === "Missing semicolon");
            assert(c[2].severity === "error");
            assert(c[2].sourceLocation.path === "lib/inspection/tslint.ts");
            assert(c[2].sourceLocation.columnFrom1 === 14);
            assert(c[2].sourceLocation.lineFrom1 === 1);
            assert(c[2].sourceLocation.offset === 13);
        });

        it("should handle no output", () => {
            errorMessage = undefined;
            const c = mapTslintResultsToReviewComments("", "");
            assert(c.length === 0);
            assert(errorMessage);
            assert(errorMessage.startsWith("Failed to parse TSLint output '"));
        });

        it("should handle output with just whitespace", () => {
            errorMessage = undefined;
            const c = mapTslintResultsToReviewComments("  \n", "");
            assert(c.length === 0);
            assert(errorMessage);
            assert(errorMessage.startsWith("Failed to parse TSLint output '"));
        });

        it("should handle bad input", () => {
            errorMessage = undefined;
            const c = mapTslintResultsToReviewComments("]})({[", "");
            assert(c.length === 0);
            assert(errorMessage);
            assert(errorMessage.startsWith("Failed to parse TSLint output '"));
        });

    });

    describe("failGoalsIfErrorCommentsReviewListener", () => {

        it("should fail the goals if error comments exists", async () => {
            const rli: ReviewListenerInvocation = {
                review: {
                    comments: [
                        { severity: "error" },
                    ],
                },
            } as any;
            const r = await failGoalsIfErrorCommentsReviewListener(rli);
            assert(r === PushImpactResponse.failGoals);
        });

        it("should proceed if no error comments exists", async () => {
            const rli: ReviewListenerInvocation = {
                review: {
                    comments: [
                        { severity: "warning" },
                        { severity: "info" },
                        { severity: "warning" },
                    ],
                },
            } as any;
            const r = await failGoalsIfErrorCommentsReviewListener(rli);
            assert(r === PushImpactResponse.proceed);
        });

        it("should find an error in several comments", async () => {
            const rli: ReviewListenerInvocation = {
                review: {
                    comments: [
                        { severity: "warning" },
                        { severity: "info" },
                        { severity: "warning" },
                        { severity: "error" },
                        { severity: "info" },
                        { severity: "warning" },
                    ],
                },
            } as any;
            const r = await failGoalsIfErrorCommentsReviewListener(rli);
            assert(r === PushImpactResponse.failGoals);
        });

        it("should proceed if there are no comments", async () => {
            const rli: ReviewListenerInvocation = {
                review: { comments: [] },
            } as any;
            const r = await failGoalsIfErrorCommentsReviewListener(rli);
            assert(r === PushImpactResponse.proceed);
        });

    });

});
