"use strict";

import { settings } from "./globals.js";

// TODO: logger
// TODO: import/export

export function arrayDelete(array, ...values) {
    for (const value of values) {
        const index = array.indexOf(value);
        if (index !== -1) {
            array.splice(index, 1);
        }
    }
    return array;
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

export async function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
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

// while performanceEnabled should be taken from global settings, global settings may not have been initialized by the time when the function is called
export function funcPerformance(func, funcName = func.name, thisArg = undefined, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return func;
    function inner(...rest) {
        const caller = createCallStack()[1];
        const t0 = performance.now();
        const result = Promise.resolve(func.apply(thisArg, rest)).then((result) => {
            console.log(`${funcName} (called by ${caller}) took ${performance.now() - t0} milliseconds`);
            return result;
        });
        return result;
    }
    return inner;
}

export function classPerformance(cls, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return;
    for (const propertyName of arrayDelete(Object.getOwnPropertyNames(cls), "prototype", "length", "name")) {
        if (!(typeof cls[propertyName] === "function"))
            continue;
        cls[propertyName] = funcPerformance(cls[propertyName], `${cls.name}.${cls[propertyName].name}`, undefined, performanceEnabled);
    }
}

export function instancePerformance(instance, instanceName, performanceEnabled = settings.performanceEnabled) {
    if (!performanceEnabled)
        return;
    const proto = Object.getPrototypeOf(instance);
    for (const propertyName of arrayDelete(Object.getOwnPropertyNames(proto), "constructor")) {
        instance[propertyName] = funcPerformance(proto[propertyName], `${proto.constructor.name}(${instanceName}).${proto[propertyName].name}`, instance, performanceEnabled);
    }
}