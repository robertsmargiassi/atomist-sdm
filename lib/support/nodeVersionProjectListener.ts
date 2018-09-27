import { GoalProjectListenerRegistration } from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";
import { npmVersionPreparation } from "@atomist/sdm-pack-node/lib/build/npmBuilder";

export const NodeVersionProjectListener: GoalProjectListenerRegistration = {
    name: "npm version",
    pushTest: IsNode,
    listener: npmVersionPreparation,
}