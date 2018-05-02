import { HandlerContext } from "@atomist/automation-client";
import { Tags } from "@atomist/automation-client/operations/tagger/Tagger";
import { Project } from "@atomist/automation-client/project/Project";

export const AutomationClientTagger: (p: Project, context: HandlerContext, params?: any) => Promise<Tags> =
    async p => {
        return {
            repoId: p.id,
            tags: ["atomist", "nodejs", "typescript", "automation"],
        };
    };
