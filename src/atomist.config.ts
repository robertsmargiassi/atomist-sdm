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
