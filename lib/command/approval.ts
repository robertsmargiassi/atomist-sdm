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

import {
    addressEvent,
    configurationValue,
    Parameter,
    Parameters,
    QueryNoCacheOptions,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    GoalRootType,
    slackSuccessMessage,
    slackWarningMessage,
} from "@atomist/sdm";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";
import {
    SdmGoal,
    SdmGoalState,
} from "../typings/types";

@Parameters()
class ApprovalParameters {

    @Parameter({ displayable: false, required: true })
    public goalSetId: string;

    @Parameter({ displayable: false, required: true })
    public goalUniqueName: string;

    @Parameter({ displayable: false, required: true })
    public goalState: SdmGoalState;

    @Parameter({ required: false })
    public msgId: string;

}

export const ApprovalCommand: CommandHandlerRegistration<ApprovalParameters> = {
    name: "ApprovalCommand",
    intent: [],
    paramsMaker: ApprovalParameters,
    listener: async ci => {

        const goal = (await ci.context.graphClient.query<SdmGoal.Query, SdmGoal.Variables>({
            name: "SdmGoal",
            variables: {
                goalSetId: [ci.parameters.goalSetId],
                state: [ci.parameters.goalState],
                uniqueName: [ci.parameters.goalUniqueName],
            },
            options: QueryNoCacheOptions,
        })).SdmGoal[0];

        const updatedGoal = _.cloneDeep(goal);
        updatedGoal.ts = Date.now();

        updatedGoal.data = JSON.stringify({ approved: true });

        await ci.context.messageClient.send(updatedGoal, addressEvent(GoalRootType));
        await ci.context.messageClient.respond(
            slackSuccessMessage(
                "Approve Goal",
                `Successfully approved goal _${goal.name}_ on ${codeLine(goal.sha.slice(0, 7))} of ${
                    bold(`${goal.repo.owner}/${goal.repo.name}`)}`,
                {
                    footer: `${configurationValue<string>("name")}:${configurationValue<string>("version")}`,
                }),
            {
                id: ci.parameters.msgId,
            });
    },
};

export const CancelApprovalCommand: CommandHandlerRegistration<ApprovalParameters> = {
    name: "CancelApprovalCommand",
    intent: [],
    paramsMaker: ApprovalParameters,
    listener: async ci => {

        const goal = (await ci.context.graphClient.query<SdmGoal.Query, SdmGoal.Variables>({
            name: "SdmGoal",
            variables: {
                goalSetId: [ci.parameters.goalSetId],
                state: [ci.parameters.goalState],
                uniqueName: [ci.parameters.goalUniqueName],
            },
            options: QueryNoCacheOptions,
        })).SdmGoal[0];

        const updatedGoal = _.cloneDeep(goal);
        updatedGoal.ts = Date.now();

        if (ci.parameters.goalState === SdmGoalState.approved) {
            updatedGoal.state = SdmGoalState.waiting_for_approval;
            updatedGoal.approval = undefined;
        } else if (ci.parameters.goalState === SdmGoalState.pre_approved) {
            updatedGoal.state = SdmGoalState.waiting_for_pre_approval;
            updatedGoal.preApproval = undefined;
        }
        await ci.context.messageClient.send(updatedGoal, addressEvent(GoalRootType));
        await ci.context.messageClient.respond(
            slackWarningMessage(
                "Approve Goal",
                `Successfully canceled approval of goal _${goal.name}_ on ${codeLine(goal.sha.slice(0, 7))} of ${
                    bold(`${goal.repo.owner}/${goal.repo.name}`)}`,
                ci.context,
                {
                    footer: `${configurationValue<string>("name")}:${configurationValue<string>("version")}`,
                }),
            {
                id: ci.parameters.msgId,
            });
    },
};
