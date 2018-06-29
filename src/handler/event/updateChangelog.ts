import {
    EventFired,
    HandlerContext,
    HandlerResult,
    Parameters,
    Value,
} from "@atomist/automation-client";
import { OnEvent } from "@atomist/automation-client/onEvent";
import { addChangelogEntryForClosedIssue } from "../../editing/changelog/changelog";
import { ClosedIssueWithChangelog } from "../../typings/types";

@Parameters()
export class TokenParameters {
    @Value("token")
    public orgToken: string;
}

export const UpdateChangelog: OnEvent<ClosedIssueWithChangelog.Subscription, TokenParameters> =
    (e: EventFired<ClosedIssueWithChangelog.Subscription>,
     ctx: HandlerContext,
     params: TokenParameters): Promise<HandlerResult> => {
    return addChangelogEntryForClosedIssue(e.data.Issue[0], params.orgToken);
};
