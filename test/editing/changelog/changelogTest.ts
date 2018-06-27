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
import * as appRoot from "app-root-path";
import * as assert from "power-assert";
import {
    addEntryToChangelog,
    ChangelogEntry,
    readChangelog,
    writeChangelog,
} from "../../../src/editing/changelog/changelog";

describe("changelog", () => {

    it("should read changelog", () => {
        const p = { baseDir: appRoot.path } as any as GitProject;
        return readChangelog(p)
            .then(result => {
                assert(result.versions.length > 2);
                assert.equal(result.title, "Change Log");
            });
    });

    it("should add entry to changelog", () => {
        const p = {
            baseDir: appRoot.path,
            id: {
                owner: "atomist",
                repo: "test",
            },
        } as any as GitProject;
        const entry: ChangelogEntry = {
            issue: 1,
            title: "This is a test issue",
            category: "added",
            url: "https://github.com/atomist/test/issues/1",
        };
        return readChangelog(p).then(result => {
            const cl = addEntryToChangelog(entry, result, p);
            assert.equal(cl.versions[0].parsed.Added[0],
                "-   This is a test issue [#1](https://github.com/atomist/test/issues/1)");
        });
    });

    it("should convert change back to markdown", () => {
        const p = {
            baseDir: appRoot.path,
            id: {
                owner: "atomist",
                repo: "test",
            },
        } as any as GitProject;
        const entry: ChangelogEntry = {
            issue: 1,
            title: "This is a test issue with some really long text and some more bla bla bla. And even some more and more and more.",
            category: "added",
            url: "https://github.com/atomist/test/issues/1",
        };
        return readChangelog(p).then(result => {
            const cl = addEntryToChangelog(entry, result, p);
            return writeChangelog(cl, p);
        });
    });
});
