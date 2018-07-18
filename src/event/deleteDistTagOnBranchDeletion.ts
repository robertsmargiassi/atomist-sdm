import {
    Parameters,
    Secret,
    Secrets,
    Success,
} from "@atomist/automation-client";
import { subscription } from "@atomist/automation-client/graph/graphQL";
import { OnEvent } from "@atomist/automation-client/onEvent";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {
    EventHandlerRegistration,
    ProjectLoader,
} from "@atomist/sdm";
import { NpmOptions } from "@atomist/sdm-core";
import { deleteBranchTag } from "@atomist/sdm-core/internal/delivery/build/local/npm/executePublish";
import { OnDeletedBranch } from "../typings/types";

@Parameters()
export class TokenParameters {

    @Secret(Secrets.OrgToken)
    public readonly token: string;
}

function deleteDistTagOnBranchDeletionHandle(
    projectLoader: ProjectLoader,
                                             options: NpmOptions): OnEvent<OnDeletedBranch.Subscription, TokenParameters> {

    return async (e, context, params) => {

        const repo = e.data.DeletedBranch[0].repo;
        const branch = e.data.DeletedBranch[0].name;
        const id = GitHubRepoRef.from({ owner: repo.owner, repo: repo.name, branch: repo.defaultBranch});

        return projectLoader.doWithProject(
            { credentials: { token: params.token }, context, readOnly: true, id },
            async p => {
                await deleteBranchTag(branch, p, options);
                return Success;
            });
    };
}

export function deleteDistTagOnBranchDeletion(projectLoader: ProjectLoader,
                                              options: NpmOptions): EventHandlerRegistration<OnDeletedBranch.Subscription, TokenParameters> {
    return {
        name: "DeleteDistTagOnBranchDeletion",
        description: "Delete a NPM dist-tag when a branch gets deleted",
        tags: ["branch", "npm", "dist-tag"],
        paramsMaker: TokenParameters,
        listener: deleteDistTagOnBranchDeletionHandle(projectLoader, options),
        subscription: subscription("onDeletedBranch"),
    }
}