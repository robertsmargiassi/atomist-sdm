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

import * as assert from "power-assert";
import { ingressFromGoal } from "../../lib/machine/k8Support";

describe("k8Support", () => {

    describe("ingressFromGoal", () => {

        it("should return the production ingress for card-automation", () => {
            const r = "card-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            assert(i.host === "pusher.atomist.com");
            assert(i.path === "/");
            assert(i.tlsSecret === "star-atomist-com");
            const s = { name: r, ...i };
            const e = {
                name: r,
                host: "pusher.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(s, e);
        });

        it("should return the testing ingress for card-automation", () => {
            const r = "card-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            assert(i.host === "pusher.atomist.services");
            assert(i.path === "/");
            assert(i.tlsSecret === "star-atomist-services");
        });

        it("should return undefined", () => {
            const r = "schmard-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            assert(i === undefined);
            // make sure you can spread undefined with no side effect
            const s = { name: r, ...i };
            assert.deepStrictEqual(s, { name: r });
        });

        it("should return .services host for testing intercom-automation", () => {
            const r = "intercom-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "intercom.atomist.services",
                path: "/",
                tlsSecret: "star-atomist-services",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .com host for production intercom-automation", () => {
            const r = "intercom-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "intercom.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return non-TLS .services host for testing sdm-automation", () => {
            const r = "sdm-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.services",
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return non-TLS .com host for production sdm-automation", () => {
            const r = "sdm-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.com",
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

    });

});
