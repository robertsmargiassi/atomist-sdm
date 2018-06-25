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

import * as assert from "power-assert";

import {
    changeLogAddRelease,
    formatDate,
} from "../../src/machine/release";

describe("release", () => {

    describe("formatDate", () => {

        it("should return a properly formatted date", () => {
            const d = new Date("August 6, 1969");
            const e = "1969-08-06";
            const f = formatDate(d);
            assert(f === e);
        });

    });

    describe("changeLogAddRelease", () => {

        const date = formatDate();
        const c = `# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][]

[Unreleased]: https://github.com/atomist/atomist-sdm/compare/0.1.1...HEAD

### Added

-   Publish TypeDoc when Node project is released
-   Increment version after release
-   Common build tools to Docker image

### Changed

-   Lein support now uses atomist.sh to build

## [0.1.1][] - 2018-05-10

[0.1.1]: https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1

Trigger release

### Changed

-   Version

## [0.1.0][] - 2018-05-10

Initial release

[0.1.0]: https://github.com/atomist/atomist-sdm/tree/0.1.0

### Added

-   Build, deploy, and release automation-client/SDM projects
-   Build and deploy lein projects
-   Build TypeScript projects
`;
        const e = `# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][]

[Unreleased]: https://github.com/atomist/atomist-sdm/compare/0.2.0...HEAD

## [0.2.0][] - ${date}

[0.2.0]: https://github.com/atomist/atomist-sdm/compare/0.1.1...0.2.0

### Added

-   Publish TypeDoc when Node project is released
-   Increment version after release
-   Common build tools to Docker image

### Changed

-   Lein support now uses atomist.sh to build

## [0.1.1][] - 2018-05-10

[0.1.1]: https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1

Trigger release

### Changed

-   Version

## [0.1.0][] - 2018-05-10

Initial release

[0.1.0]: https://github.com/atomist/atomist-sdm/tree/0.1.0

### Added

-   Build, deploy, and release automation-client/SDM projects
-   Build and deploy lein projects
-   Build TypeScript projects
`;

        it("should create a release section", () => {
            const n = changeLogAddRelease(c, "0.2.0");
            assert(n === e);
        });

        it("should do nothing if section for release exists", () => {
            const n = changeLogAddRelease(c, "0.1.1");
            assert(n === c);
        });

        const ci = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/atomist-sdm/compare/0.1.1...HEAD)

### Added

-   Publish TypeDoc when Node project is released
-   Increment version after release
-   Common build tools to Docker image

### Changed

-   Lein support now uses atomist.sh to build

## [0.1.1](https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1) - 2018-05-10

Trigger release

### Changed

-   Version

## [0.1.0](https://github.com/atomist/atomist-sdm/tree/0.1.0) - 2018-05-10

Initial release

### Added

-   Build, deploy, and release automation-client/SDM projects
-   Build and deploy lein projects
-   Build TypeScript projects
`;
        const ei = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/atomist-sdm/compare/0.2.0...HEAD)

## [0.2.0](https://github.com/atomist/atomist-sdm/compare/0.1.1...0.2.0) - ${date}

### Added

-   Publish TypeDoc when Node project is released
-   Increment version after release
-   Common build tools to Docker image

### Changed

-   Lein support now uses atomist.sh to build

## [0.1.1](https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1) - 2018-05-10

Trigger release

### Changed

-   Version

## [0.1.0](https://github.com/atomist/atomist-sdm/tree/0.1.0) - 2018-05-10

Initial release

### Added

-   Build, deploy, and release automation-client/SDM projects
-   Build and deploy lein projects
-   Build TypeScript projects
`;

        it("should create a release section with inline links", () => {
            const n = changeLogAddRelease(ci, "0.2.0");
            assert(n === ei);
        });

        it("should do nothing if section for release with inline links exists", () => {
            const n = changeLogAddRelease(ci, "0.1.1");
            assert(n === ci);
        });

    });

});
