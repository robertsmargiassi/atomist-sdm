/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Success } from "@atomist/automation-client";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { Issue } from "@atomist/automation-client/util/gitHub";
import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import { updateIssue } from "@atomist/sdm-core";
import { truncateCommitMessage } from "@atomist/sdm-core/util/lifecycleHelpers";
import { warning } from "@atomist/sdm-core/util/slack/messages";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";

export function addTeamPolicies(sdm: SoftwareDeliveryMachine<SoftwareDeliveryMachineConfiguration>) {

    // Upper case the title of a new issue
    sdm.addNewIssueListener(async l => {
        return upperCaseTitle(l.issue, l.credentials, l.id, l.issue.number);
    });

    // Upper case the title of a new pull request
    sdm.addPullRequestListener(async l => {
        const pr = l.pullRequest;
        return upperCaseTitle(pr, l.credentials, l.id, pr.number);
    });

    // Check case of commit message; they should use upper case too
    sdm.addPushReaction(async l => {
        const screenName = _.get(l.push, "after.committer.person.chatId.screenName");
        const commits = l.push.commits.filter(c => !isUpperCase(c.message));
        if (screenName && commits.length > 0) {
            const msg = warning(
                "Commit Message",
                `Please make sure that your commit messages start with an upper case letter.

The following ${commits.length > 1 ? "commits" : "commit"} in ${bold(`${l.push.repo.owner}/${l.push.repo.name}`)} ${
                    commits.length > 1 ? "don't" : "doesn't"} follow that standard:

${commits.map(c => `${codeLine(c.sha.slice(0, 7))} ${truncateCommitMessage(c.message, l.push.repo)}`).join("\n")}`,
                l.context, {
                    footer: `${sdm.configuration.name}:${sdm.configuration.version}`,
                });
            await l.context.messageClient.addressUsers(
                msg,
                screenName,
                {
                    id: `team_policies/commit_messages/${l.push.after.sha}`,
                });
        }
        return Success;
    });
}

async function upperCaseTitle(issueOrPr: { title?: string, body?: string },
                              credentials: string | ProjectOperationCredentials,
                              rr: RemoteRepoRef,
                              issueNumber: number) {
    const title = issueOrPr.title;
    if (!isUpperCase(title)) {
        const newIssue: Issue = {
            title: _.upperFirst(title),
            body: issueOrPr.body,
        };
        await updateIssue(credentials, rr, issueNumber, newIssue);
    }
    return Success;
}

function isUpperCase(message: string): boolean {
    return message && message.charAt(0) === message.charAt(0).toUpperCase();
}
