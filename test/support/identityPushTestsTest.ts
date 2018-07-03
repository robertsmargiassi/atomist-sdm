import { IsNamed } from "../../src/support/identityPushTests";
import * as assert from "assert";

describe("IsNamed push test", () => {

    it("Names itself uniquely for unique input", () => {

        const pt1 = IsNamed("Yes", "No");

        const pt2 = IsNamed("No");

        assert(pt1.name !== pt2.name, `${pt1.name} = ${pt2.name}`);
    })
});
