"use strict";

import { ArrayExtensions } from "./extensions.js";
import { log, settings } from "./globals.js";
import { createCallStack, isThenable } from "./utility.js";

// while performanceEnabled should be taken from global settings, global settings may not have been initialized by the time when the function is called
export function funcPerformance(func, funcName = func.name, thisArg = undefined, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return func;

    function inner(...rest) {
        const caller = createCallStack()[1];
        const t0 = performance.now();
        const result = func.apply(thisArg, rest);
        const t1 = performance.now();
        if (!isThenable(result)) {
            log.debug(`%c${funcName} (called by ${caller}) took ${t1 - t0} milliseconds`, "color: #7e917a");
            return result;
        }
        return Promise.resolve(result).then((result) => {
            log.debug(`%c${funcName} (called by ${caller}) took ${performance.now() - t0} milliseconds`, "color: #7e917a");
            return result;
        });
    }

    return inner;
}

export function classPerformance(cls, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return;
    for (const propertyName of ArrayExtensions.deleteValues(Object.getOwnPropertyNames(cls), "prototype", "length", "name")) {
        if (!(typeof cls[propertyName] === "function"))
            continue;
        cls[propertyName] = funcPerformance(
            cls[propertyName],
            `${cls.name}.${cls[propertyName].name}`,
            cls,
            performanceEnabled
        );
    }
}

export function instancePerformance(instance, instanceName, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return;
    const proto = Object.getPrototypeOf(instance);
    for (const propertyName of ArrayExtensions.deleteValues(Object.getOwnPropertyNames(proto), "constructor")) {
        instance[propertyName] = funcPerformance(
            proto[propertyName],
            `${proto.constructor.name}(${instanceName}).${proto[propertyName].name}`,
            instance,
            performanceEnabled
        );
    }
}