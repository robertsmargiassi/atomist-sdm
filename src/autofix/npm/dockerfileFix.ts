import {
    AutofixRegistration,
    hasFile,
} from "@atomist/sdm";

const NpmVersion = "6.2.0";

export const NpmDockerfileFix: AutofixRegistration = {
    name: "Dockerfile NPM install",
    pushTest: hasFile("Dockerfile"),
    transform: async p => {
        const df = await p.getFile("Dockerfile");
        const dfc = await df.getContent();
        await df.setContent(
            dfc.replace(/npm\s[i|install].*npm@[0-9\.]*/, `npm install -g npm@${NpmVersion}`));
        return p;
    }
}