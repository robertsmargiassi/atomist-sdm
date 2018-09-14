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
    Configuration,
    GitProject,
    logger,
} from "@atomist/automation-client";
import { KubernetesOptions } from "@atomist/sdm-core";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { kubernetesSupport } from "@atomist/sdm-pack-k8";
import { createKubernetesData } from "@atomist/sdm-pack-k8/dist";
import { IsMaven } from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import {
    allSatisfied,
    IsDeployEnabled,
    ProductionEnvironment,
    RepoContext,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    ProductionDeploymentGoal,
    StagingDeploymentGoal,
} from "./goals";

/**
 * Add Kubernetes implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addk8Support(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    sdm.addExtensionPacks(
        kubernetesSupport({
            deployments: [{
                goal: StagingDeploymentGoal,
                pushTest: HasDockerfile,
                callback: kubernetesDataCallback(sdm.configuration),
            }, {
                goal: ProductionDeploymentGoal,
                pushTest: allSatisfied(HasDockerfile, IsDeployEnabled),
                callback: kubernetesDataCallback(sdm.configuration),
            }],
        }),
    );
    return sdm;
}

export function kubernetesDataCallback(
    configuration: SoftwareDeliveryMachineConfiguration,
): (goal: SdmGoalEvent, context: RepoContext) => Promise<SdmGoalEvent> {

    return async (goal, ctx) => {
        return configuration.sdm.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {
            return kubernetesDataFromGoal(goal, p, configuration);
        });
    };
}

function kubernetesDataFromGoal(
    goal: SdmGoalEvent,
    p: GitProject,
    configuration: Configuration,
): Promise<SdmGoalEvent> {

    const ns = namespaceFromGoal(goal);
    const ingress = ingressFromGoal(goal.repo.name, ns);
    const port = IsMaven.predicate(p) ? 8080 : 2866;
    return createKubernetesData(
        goal,
        {
            name: goal.repo.name,
            environment: configuration.environment.split("_")[0],
            port,
            ns,
            imagePullSecret: "atomistjfrog",
            replicas: ns === "production" ? 3 : 1,
            ...ingress,
        } as KubernetesOptions,
        p);
}

function namespaceFromGoal(goal: SdmGoalEvent): string {
    const name = goal.repo.name;
    if (/-sdm$/.test(name) && name !== "sample-sdm" && name !== "spring-sdm") {
        return "sdm";
    } else if (name === "k8-automation") {
        return "k8-automation";
    } else if (goal.environment === StagingEnvironment.replace(/\/$/, "")) {
        return "testing";
    } else if (goal.environment === ProductionEnvironment.replace(/\/$/, "")) {
        return "production";
    } else {
        logger.debug(`Unmatched goal.environment using default namespace: ${goal.environment}`);
        return "default";
    }
}

export interface Ingress {
    host: string;
    path: string;
    tlsSecret?: string;
}

export function ingressFromGoal(repo: string, ns: string): Ingress {
    let host: string;
    let path: string;
    if (repo === "card-automation") {
        host = "pusher";
        path = "/";
    } else if (repo === "sdm-automation") {
        return {
            host: "badge",
            path: "/",
        };
    } else if (repo === "intercom-automation") {
        host = "intercom";
        path = "/";
    } else if (repo === "rolar") {
        host = "rolar";
        path = "/";
    } else {
        return undefined;
    }
    const tail = (ns === "production") ? "com" : "services";
    return {
        host: `${host}.atomist.${tail}`,
        path,
        tlsSecret: `star-atomist-${tail}`,
    };
}
