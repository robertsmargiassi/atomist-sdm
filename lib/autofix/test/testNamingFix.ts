import {
    doWithAllMatches,
    doWithFiles,
    TypeScriptES6FileParser,
} from "@atomist/automation-client";
import {
    AutofixRegistration,
    CodeTransform,
    CodeTransformRegistration,
} from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";

/**
 * CodeTransform that renames tests
 */
const RenameTestsTransform: CodeTransform = async project => {
    await doWithAllMatches(project, TypeScriptES6FileParser,
        "test/**/*.ts",
        "//ImportDeclaration//StringLiteral",
        m => {
            if (!m.$value.includes("/src")) {
                m.$value = m.$value.replace(/Test$/, ".test");
            }
        });
    return doWithFiles(project, "test/**/*.ts", async f => {
        return f.setPath(f.path.replace(/Test\.ts$/, ".test.ts"));
    });
};

export const RenameTestFix: AutofixRegistration = {
    name: "TypeScript tests",
    pushTest: IsNode,
    transform: RenameTestsTransform,
};

export const RenameTest: CodeTransformRegistration = {
    name: "RenameTest",
    intent: "rename tests",
    transform: RenameTestsTransform,
}