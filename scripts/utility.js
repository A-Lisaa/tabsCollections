"use strict";

import { ArrayExtensions } from "./extensions.js";
import { log, settings } from "./globals.js";

// TODO: import/export

export function Uint8ArrayComparer(array1, array2) {
    if (array1.length !== array2.length)
        return false;
    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i])
            return false;
    }
    return true;
}

export function arrayBufferComparer(buffer1, buffer2) {
    return Uint8ArrayComparer(new Uint8Array(buffer1), new Uint8Array(buffer2));
}

// TODO: move the regex stuff out
export async function regexStability(regex, string) {
    let matchesCount = 0;
    for (let i = 0; i < string.length; i++) {
        let substring = string.slice(0, i) + string.slice(i + 1, string.length);
        matchesCount += regex.test(substring);
    }
    return matchesCount;
}
regexStability = funcPerformance(regexStability);

export async function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function unescapeRegex(string) {
    return string.replace(/\\(.)/g, "$1");
}

// TODO: move the performance stuff out
export function createCallStack() {
    const stack = [];
    for (const line of (new Error()).stack.split("\n").slice(1, -2)) {
        let func = line.split("@")[0];
        if (func.startsWith("async*")) {
            func = func.split("*")[1];
            if (func === "")
                continue;
        }
        stack.push(func);
    }
    return stack;
}

export function isThenable(obj) {
    return obj["then"] !== undefined;
}

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
            log.debug(`${funcName} (called by ${caller}) took ${t1 - t0} milliseconds`);
            return result;
        }
        return Promise.resolve(result).then((result) => {
            log.debug(`${funcName} (called by ${caller}) took ${performance.now() - t0} milliseconds`);
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
        cls[propertyName] = funcPerformance(cls[propertyName], `${cls.name}.${cls[propertyName].name}`, undefined, performanceEnabled);
    }
}

export function instancePerformance(instance, instanceName, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return;
    const proto = Object.getPrototypeOf(instance);
    for (const propertyName of ArrayExtensions.deleteValues(Object.getOwnPropertyNames(proto), "constructor")) {
        instance[propertyName] = funcPerformance(proto[propertyName], `${proto.constructor.name}(${instanceName}).${proto[propertyName].name}`, instance, performanceEnabled);
    }
}