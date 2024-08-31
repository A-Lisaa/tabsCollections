"use strict";

import { Collection } from "./Collection.js";
import { Tab } from "./Tab.js";
import { regexStability } from "./utility.js";

browser.runtime.onInstalled.addListener(() => {
    browser.menus.create({
        id: "showTabsCollectionsPage",
        title: "Show tabsCollections Page",
        contexts: ["action"]
    });

    browser.menus.onClicked.addListener((info) => {
        if (info.menuItemId === "showTabsCollectionsPage") {
            browser.tabs.create({
                active: true,
                index: 0,
                pinned: true,
                url: "../pages/tabsCollections.html",
            });
        }
    });
});

browser.action.onClicked.addListener(async () => {
    const collections = await Collection.getAll();
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    for (const tab of selectedTabs) {
        const mostSpecificCollections = [];
        let mostSpecicicMatchesCount = Infinity;
        for (const collection of collections) {
            for (const filter of collection.filters) {
                let regexMatches = await regexStability(filter, tab.url);
                if (regexMatches > 0) {
                    if (regexMatches < mostSpecicicMatchesCount) {
                        mostSpecificCollections[0] = collection;
                    }
                    else if (regexMatches === mostSpecicicMatchesCount) {
                        mostSpecificCollections.push(collection);
                    }
                    mostSpecicicMatchesCount = regexMatches;
                    break;
                }
            }
        }
        if (mostSpecificCollections.length === 0)
            console.warn("No matches found");
        else if (mostSpecificCollections.length > 1)
            console.warn(`Multiple matches found: ${mostSpecificCollections.map(c => c.filters)}`);
        else {
            await Tab.create(mostSpecificCollections[0].id, tab.url, tab.title, tab.favIconUrl);
        }
    }
});