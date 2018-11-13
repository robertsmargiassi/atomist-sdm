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
    ReviewComment,
} from "@atomist/automation-client";
import {
    PushImpactResponse,
    ReviewListener,
    ReviewListenerRegistration,
} from "@atomist/sdm";

/**
 * Return true if there are any review comments with a severity of "error".
 * @param rli invocation with all comments
 * @return true if any comments have severity "error", false otherwise
 */
export function errorsExistReviewListener(pirIfError: PushImpactResponse): ReviewListener {
    return async rli => {
        if (rli && rli.review && rli.review.comments && rli.review.comments.some(c => c.severity === "error")) {
            return pirIfError;
        }
        return PushImpactResponse.proceed;
    };
}

/**
 * Listener that fails the code inspection if the review has any
 * error comments.
 */
export const FailGoalIfErrorComments: ReviewListenerRegistration = {
    name: "Fail goal if any code inspections result in comments with severity error",
    listener: errorsExistReviewListener(PushImpactResponse.failGoals),
};

/**
 * Listener that requires approval on the code inspection if the
 * review has any error comments.
 */
export const ApproveGoalIfErrorComments: ReviewListenerRegistration = {
    name: "Require approval if any code inspections result in comments with severity error",
    listener: errorsExistReviewListener(PushImpactResponse.requireApprovalToProceed),
};

/* tslint:disable:cyclomatic-complexity */
/**
 * Function suitable for use by Array.prototype.sort() to sort review
 * comments by severity, category, subcategory, and sourceLocation
 * path and offset.  Items with the same severity, category, and
 * subcategory without a location are sorted before those having a
 * location.
 *
 * @param a First element to compare.
 * @param b Second element to compare.
 * @return -1 if a sorts first, 1 if b sorts first, and 0 if they are equivalent.
 */
export function reviewCommentSorter(a: ReviewComment, b: ReviewComment): number {
    if (a.severity !== b.severity) {
        const severities = ["error", "warn", "info"];
        for (const severity of severities) {
            if (a.severity === severity) {
                return -1;
            } else if (b.severity === severity) {
                return 1;
            }
        }
    }
    if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
    }
    if (a.subcategory !== b.subcategory) {
        return a.subcategory.localeCompare(b.subcategory);
    }
    if (!a.sourceLocation && b.sourceLocation) {
        return -1;
    } else if (a.sourceLocation && !b.sourceLocation) {
        return 1;
    } else {
        if (a.sourceLocation.path !== b.sourceLocation.path) {
            return a.sourceLocation.path.localeCompare(b.sourceLocation.path);
        } else {
            return a.sourceLocation.offset - b.sourceLocation.offset;
        }
    }
    return 0;
}
/* tslint:enable:cyclomatic-complexity */
