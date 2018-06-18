import "mocha";
import { Project } from "@atomist/automation-client/project/Project";
import * as assert from "power-assert";
import { addThirdPartyLicenseEditor } from "../../../src/autofix/license/thirdPartyLicense";
import * as appRoot from "app-root-path";


describe("thirdPartyLicense", () => {

    it("should create license file", done => {

        addThirdPartyLicenseEditor({ baseDir: appRoot.path, addFile: (name, content) => {} } as any as Project)
            .then(() => {
                done();
            });

    });
});
