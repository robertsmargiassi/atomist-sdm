# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/atomist-sdm/compare/0.3.4...HEAD)

### Changed

-   Move TSLint from build step to code inspection. [#82](https://github.com/atomist/atomist-sdm/issues/82)

## [0.3.4](https://github.com/atomist/atomist-sdm/compare/0.3.3...0.3.4) - 2018-11-07

## [0.3.3](https://github.com/atomist/atomist-sdm/compare/0.3.2...0.3.3) - 2018-11-07

## [0.3.2](https://github.com/atomist/atomist-sdm/compare/0.3.1...0.3.2) - 2018-11-06

## [0.3.1](https://github.com/atomist/atomist-sdm/compare/0.3.0...0.3.1) - 2018-11-05

## [0.3.0](https://github.com/atomist/atomist-sdm/compare/0.2.0...0.3.0) - 2018-11-05

### Added

-   Add fingerprint support for npm. [#52](https://github.com/atomist/atomist-sdm/issues/52)
-   Keep collaborator documents up to date. [#68](https://github.com/atomist/atomist-sdm/issues/68)
-   Update Homebrew formula for CLI when it is released. [#69](https://github.com/atomist/atomist-sdm/issues/69)
-   Provide autofix for tslint.json. [#77](https://github.com/atomist/atomist-sdm/issues/77)

### Changed

-   Update src to lib in dependencies. [#54](https://github.com/atomist/atomist-sdm/issues/54)
-   Move to projectListeners for nom install, version and compile. [#65](https://github.com/atomist/atomist-sdm/issues/65)
-   Update Dockerfile to latest standard. [#72](https://github.com/atomist/atomist-sdm/issues/72)
-   Make update support files a code transform command. [#80](https://github.com/atomist/atomist-sdm/issues/80)
-   Run autofix on immaterial changes to Node repos. [#79](https://github.com/atomist/atomist-sdm/issues/79)

### Fixed

-   Do not add license headers to .d.ts files. [#43](https://github.com/atomist/atomist-sdm/issues/43)

## [0.2.0](https://github.com/atomist/atomist-sdm/compare/0.1.5...0.2.0) - 2018-09-11

### Added

-   Add update dependencies transform. [#bcde17b](https://github.com/atomist/atomist-sdm/commit/bcde17b9e09a0f27f14884892599004adc3ffce4)
-   Add support for SDM local mode. [#41](https://github.com/atomist/atomist-sdm/issues/41)
-   Add code transforms for Atomist peer dependencies and package.json author. [#42](https://github.com/atomist/atomist-sdm/issues/42)

### Fixed

-   Do not put a header before a shebang line. [#37](https://github.com/atomist/atomist-sdm/issues/37)

## [0.1.5](https://github.com/atomist/atomist-sdm/compare/0.1.4...0.1.5) - 2018-08-22

### Added

-   Support for releasing M and RC releases from a tag. [#30](https://github.com/atomist/atomist-sdm/issues/30)

## [0.1.4](https://github.com/atomist/atomist-sdm/compare/0.1.3...0.1.4) - 2018-07-19

### Added

-   Add team policy checks for issue and PR titles and commit messages. [#25](https://github.com/atomist/atomist-sdm/issues/25)
-   Making sure the developer tutorials get built. [#26](https://github.com/atomist/atomist-sdm/issues/26)
-   Delete NPM dist-tags when the branch gets deleted. [#27](https://github.com/atomist/atomist-sdm/issues/27)

### Changed

-   Support building non-client TypeScript projects.

### Fixed

-   Respect `#!` lines when adding license header.
-   Double approval required for non-automation-client Node.js builds. [#23](https://github.com/atomist/atomist-sdm/issues/23)

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
