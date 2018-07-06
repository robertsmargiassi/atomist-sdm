# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/atomist-sdm/compare/0.1.3...HEAD)

### Changed

-   Support building non-client TypeScript projects

### Fixed

-   Respect `#!` lines when adding license header

## [0.1.3](https://github.com/atomist/atomist-sdm/compare/0.1.1...0.1.3) - 2018-07-05

### Added

-   Mark changelog entry breaking if breaking label is used. [#18](https://github.com/atomist/atomist-sdm/issues/18)
-   Publish TypeDoc when Node project is released.
-   Increment version after release.
-   Common build tools to Docker image.
-   Add release to change log.
-   Configure ingress for card-automation. [#21](https://github.com/atomist/atomist-sdm/issues/21)

### Changed

-   Lein support disabled.
-   Breakout changelog support into extension pack. [#22](https://github.com/atomist/atomist-sdm/issues/22)

## [0.1.1](https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1) - 2018-05-10

### Changed

-   Version.

## [0.1.0](https://github.com/atomist/atomist-sdm/tree/0.1.0) - 2018-05-10

### Added

-   Build, deploy, and release automation-client/SDM projects.
-   Build and deploy lein projects.
-   Build TypeScript projects.
