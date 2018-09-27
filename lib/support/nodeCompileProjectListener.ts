import { GoalProjectListenerRegistration } from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";
import { npmCompilePreparation } from "@atomist/sdm-pack-node/lib/build/npmBuilder";

export const NodeCompileProjectListener: GoalProjectListenerRegistration = {
    name: "npm compile",
    pushTest: IsNode,
    listener: npmCompilePreparation,
}