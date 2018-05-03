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

import { logFactory } from "@atomist/sample-sdm/blueprint/log/logFactory";
import {
    CachingProjectLoader,
    configureForSdm,
    DockerOptions,
    EphemeralLocalArtifactStore,
    SoftwareDeliveryMachineOptions,
} from "@atomist/sdm";
import { machine } from "./machine/machine";
import { configureLogzio } from "./util/logzio";

const SdmOptions: SoftwareDeliveryMachineOptions & DockerOptions = {

    // SDM Options
    artifactStore: new EphemeralLocalArtifactStore(),
    projectLoader: new CachingProjectLoader(),
    logFactory: logFactory("http://rolar.cfapps.io"),

    // Docker options
    registry: process.env.ATOMIST_DOCKER_REGISTRY,
    user: process.env.ATOMIST_DOCKER_USER,
    password: process.env.ATOMIST_DOCKER_PASSWORD,
};

export const configuration: any = {
    postProcessors: [
        configureLogzio,
        configureForSdm(machine(SdmOptions)),
    ],
};
