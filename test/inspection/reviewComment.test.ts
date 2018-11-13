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
    ReviewComment,
} from "@atomist/automation-client";
import {
    PushImpactResponse,
    ReviewListenerInvocation,
} from "@atomist/sdm";
import * as assert from "power-assert";
import {
    errorsExistReviewListener,
    reviewCommentSorter,
} from "../../lib/inspection/reviewComments";

describe("reviewComments", () => {

    describe("", () => {

        it("should fail the goals if error comments exists", async () => {
            const rli: ReviewListenerInvocation = {
                review: {
                    comments: [
                        { severity: "error" },
                    ],
                },
            } as any;
            const r = await errorsExistReviewListener(PushImpactResponse.failGoals)(rli);
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
            const r = await errorsExistReviewListener(PushImpactResponse.failGoals)(rli);
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
            const r = await errorsExistReviewListener(PushImpactResponse.failGoals)(rli);
            assert(r === PushImpactResponse.failGoals);
        });

        it("should proceed if there are no comments", async () => {
            const rli: ReviewListenerInvocation = {
                review: { comments: [] },
            } as any;
            const r = await errorsExistReviewListener(PushImpactResponse.failGoals)(rli);
            assert(r === PushImpactResponse.proceed);
        });

    });

    describe("reviewCommentSorter", () => {

        const d: ReviewComment = {
            category: "dummy",
            detail: "dummy detail",
            severity: "error",
            subcategory: "subdummy",
            sourceLocation: {
                path: "/a/b/c.ts",
                offset: 0,
            },
        };

        it("should sort nothing", () => {
            const r: ReviewComment[] = [];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [];
            assert.deepStrictEqual(r, e);
        });

        it("should sort by severity", () => {
            const r: ReviewComment[] = [
                { ...d, severity: "info" },
                { ...d, severity: "error" },
                { ...d, severity: "warn" },
            ];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [
                { ...d, severity: "error" },
                { ...d, severity: "warn" },
                { ...d, severity: "info" },
            ];
            assert.deepStrictEqual(r, e);
        });

        it("should sort by category", () => {
            const r: ReviewComment[] = [
                { ...d, category: "third" },
                { ...d, category: "second" },
                { ...d, category: "first" },
            ];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [
                { ...d, category: "first" },
                { ...d, category: "second" },
                { ...d, category: "third" },
            ];
            assert.deepStrictEqual(r, e);
        });

        it("should sort by subcategory", () => {
            const r: ReviewComment[] = [
                { ...d, subcategory: "third" },
                { ...d, subcategory: "second" },
                { ...d, subcategory: "first" },
            ];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [
                { ...d, subcategory: "first" },
                { ...d, subcategory: "second" },
                { ...d, subcategory: "third" },
            ];
            assert.deepStrictEqual(r, e);
        });

        it("should sort by path and location", () => {
            const r: ReviewComment[] = [
                { ...d, sourceLocation: { path: "/d/e/f.ts", offset: 7 } },
                { ...d, sourceLocation: undefined },
                { ...d, sourceLocation: { path: "/g/h/i.ts", offset: 0 } },
                { ...d, sourceLocation: { path: "/d/e/f.ts", offset: 1 } },
            ];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [
                { ...d, sourceLocation: undefined },
                { ...d, sourceLocation: { path: "/d/e/f.ts", offset: 1 } },
                { ...d, sourceLocation: { path: "/d/e/f.ts", offset: 7 } },
                { ...d, sourceLocation: { path: "/g/h/i.ts", offset: 0 } },
            ];
            assert.deepStrictEqual(r, e);
        });

        it("should sort comments", () => {
            const r: ReviewComment[] = [
                {
                    category: "tslint",
                    detail: "Exceeds maximum line length of 150",
                    subcategory: "max-line-length",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 5,
                        offset: 24,
                    },
                },
                {
                    category: "nottslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "tslint",
                    detail: "Calls to 'console.log' are not allowed.",
                    subcategory: "no-console",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
                {
                    category: "tslint",
                    detail: "Calls to 'console.log' are not allowed.",
                    subcategory: "no-console",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
                {
                    category: "tslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "nottslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/reviewComment.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "tslint",
                    detail: "Exceeds maximum line length of 150",
                    subcategory: "max-line-length",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
            ];
            r.sort(reviewCommentSorter);
            const e: ReviewComment[] = [
                {
                    category: "nottslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/reviewComment.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "nottslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "tslint",
                    detail: "Missing semicolon",
                    subcategory: "semicolon",
                    severity: "error",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 14,
                        lineFrom1: 1,
                        offset: 13,
                    },
                },
                {
                    category: "tslint",
                    detail: "Exceeds maximum line length of 150",
                    subcategory: "max-line-length",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
                {
                    category: "tslint",
                    detail: "Exceeds maximum line length of 150",
                    subcategory: "max-line-length",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 5,
                        offset: 24,
                    },
                },
                {
                    category: "tslint",
                    detail: "Calls to 'console.log' are not allowed.",
                    subcategory: "no-console",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/lib/inspection/tslint.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
                {
                    category: "tslint",
                    detail: "Calls to 'console.log' are not allowed.",
                    subcategory: "no-console",
                    severity: "warn",
                    sourceLocation: {
                        path: "/home/tom/dev/waits-sdm/test/inspection/tslint.test.ts",
                        columnFrom1: 1,
                        lineFrom1: 2,
                        offset: 14,
                    },
                },
            ];
            assert.deepStrictEqual(r, e);
        });

    });

});
