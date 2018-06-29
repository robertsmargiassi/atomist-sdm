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

import { guid } from "@atomist/automation-client/internal/util/string";
import {
    Action,
    SlackMessage,
} from "@atomist/slack-messages";

export function success(title: string, text: string, actions?: Action[]): SlackMessage {
    const msg: SlackMessage = {
        attachments: [{
            author_icon: `https://images.atomist.com/rug/check-circle.gif?gif=${guid()}`,
            author_name: title,
            text,
            fallback: text,
            color: "#45B254",
            mrkdwn_in: [ "text" ],
            actions,
        }],
    };
    return msg;
}
