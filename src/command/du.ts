import { CommandHandlerRegistration } from "@atomist/sdm";
import { StringCapturingProgressLog } from "@atomist/sdm/api-helper/log/StringCapturingProgressLog";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import { codeBlock } from "@atomist/slack-messages";

export const DiskUsageCommandRegistration: CommandHandlerRegistration = {
    name: "DiskUsageCommandRegistration",
    description: "Returns information about the disk usage of this SDM",
    intent: "disk usage",
    listener: async ci => {

        const log = new StringCapturingProgressLog();
        const result = await spawnAndWatch({
                command: "du",
                args: ["-sha", "-d",  "1"],
            },
            {
                cwd: "/",
            },
            log,
            {},
        );
        await ci.context.messageClient.respond(codeBlock(log.log.trim()));
        return result;
    },
};
