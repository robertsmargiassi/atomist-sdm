import { Project } from "@atomist/automation-client/project/Project";
import * as appRoot from "app-root-path";
import { addThirdPartyLicenseEditor } from "../../../src/autofix/license/thirdPartyLicense";

describe("thirdPartyLicense", () => {

    it("should create license file", done => {
        return addThirdPartyLicenseEditor({ baseDir: appRoot.path, addFile: (name, content) => { /** empty */ } } as any as Project);
    });
});
