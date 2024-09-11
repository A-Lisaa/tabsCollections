"use strict";

// less regex stability = more specific the regex is
export function getRegexStability(regex, string) {
    let matchesCount = 0;
    for (let i = 0; i < string.length; i++) {
        let substring = string.slice(0, i) + string.slice(i + 1, string.length);
        matchesCount += regex.test(substring);
    }
    return matchesCount;
}

export function getMostSpecificRegexes(regexes, string) {
    let mostSpecificRegexStability = Infinity;
    const mostSpecificRegexes = [];
    for (const regex of regexes) {
        let regexStability = getRegexStability(regex, string);
        if (regexStability === 0 || regexStability > mostSpecificRegexStability)
            continue;
        if (regexStability < mostSpecificRegexStability) {
            mostSpecificRegexStability = regexStability;
            mostSpecificRegexes.length = 0;
        }
        mostSpecificRegexes.push(collection);
    }
}

export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function unescapeRegex(string) {
    return string.replace(/\\(.)/g, "$1");
}

export function getRegexFromString(string) {
    const expression = string.trim();

    let regex;
    if (expression.startsWith("/") && expression.endsWith("/")) {
        // expression is a regex
        regex = new RegExp(expression.slice(1, -1));
    }
    else {
        // expression is a string
        regex = new RegExp(escapeRegex(expression));
    }
    return regex;
}