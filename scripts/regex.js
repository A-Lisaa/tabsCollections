"use strict";

// less regex stability = more specific the regex is
export async function getRegexStability(regex, string) {
    let matchesCount = 0;
    for (let i = 0; i < string.length; i++) {
        let substring = string.slice(0, i) + string.slice(i + 1, string.length);
        matchesCount += regex.test(substring);
    }
    return matchesCount;
}

export async function getMostSpecificRegexes(regexes, string) {
    let mostSpecificRegexStability = Infinity;
    const mostSpecificRegexes = [];
    for (const regex of regexes) {
        let regexStability = await getRegexStability(regex, string);
        if (regexStability === 0 || regexStability > mostSpecificRegexStability)
            continue;
        if (regexStability < mostSpecificRegexStability) {
            mostSpecificRegexStability = regexStability;
            mostSpecificRegexes.length = 0;
        }
        mostSpecificRegexes.push(collection);
    }
}

export async function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function unescapeRegex(string) {
    return string.replace(/\\(.)/g, "$1");
}

export async function getRegexFromString(string) {
    const expression = string.trim();

    let regex;
    if (expression.startsWith("/") && expression.endsWith("/")) {
        // expression is a regex
        regex = new RegExp(expression.slice(1, -1));
    }
    else {
        // expression is a string
        regex = new RegExp(await escapeRegex(expression));
    }
    return regex;
}