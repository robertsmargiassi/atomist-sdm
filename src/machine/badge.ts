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
    automationClientInstance,
    MappedParameter,
    MappedParameters,
    Parameters,
} from "@atomist/automation-client";
import { guid } from "@atomist/automation-client/internal/util/string";
import { addressEvent } from "@atomist/automation-client/spi/message/MessageClient";
import { ExtensionPack } from "@atomist/sdm";
import { success } from "@atomist/sdm-core/util/slack/messages";
import { metadata } from "@atomist/sdm/api-helper/misc/extensionPack";
import {
    bold,
    codeBlock,
} from "@atomist/slack-messages";

@Parameters()
class BadgeParameters {

    @MappedParameter(MappedParameters.GitHubRepository)
    public readonly repo: string;

    @MappedParameter(MappedParameters.GitHubOwner)
    public readonly owner: string;

    @MappedParameter(MappedParameters.GitHubRepositoryProvider)
    public readonly providerId: string;
}

export const BadgeSupport: ExtensionPack = {
    ...metadata("badge"),
    configure: sdm => {

        sdm.addCommand<BadgeParameters>({
            name: "CreateSdmGoalBadgeUrl",
            description: "Create a badge url to put into your project's README.md",
            intent: ["create badge url"],
            paramsMaker: BadgeParameters,
            listener: async cli => {
                const token = guid();
                const badge = {
                    repo: {
                        name: cli.parameters.repo,
                        owner: cli.parameters.owner,
                        providerId: cli.parameters.providerId,
                    },
                    token,
                }
                await cli.context.messageClient.send(badge, addressEvent("SdmGoalSetBadge"));

                const url = `http://localhost:2866/${cli.context.teamId}/${cli.parameters.owner}/${cli.parameters.repo}/${token}`;

                const msg = success(
                    "Badge Url",
                    `Successfully created a new badge url for ${bold(`${cli.parameters.owner}/${cli.parameters.repo}`)}.
                    
${url}                    

Use the following Markdown snippet to embed the badge into your \`README.md\`:

${codeBlock(`[![atomist sdm goals](${url})](https://app.atomist.com/workspace/${cli.context.teamId})`)}`,
                    { footer: `${automationClientInstance().configuration.name}:${automationClientInstance().configuration.version}`});

                return cli.context.messageClient.respond(msg);
            }
        })
    }
};