"use strict";

import { Collection } from "./Collection.js";
import { log } from "./globals.js";
import { getRegexStability } from "./regex.js";
import { Tab } from "./Tab.js";

browser.runtime.onInstalled.addListener(() => {
    const menus = new Map([
        ["showTabsCollectionsPage", {
            "title": "Show tabsCollections Page",
            "contexts": ["action"],
            "onclick": (info) => {
                browser.tabs.create({
                    active: true,
                    index: 0,
                    pinned: true,
                    url: "../pages/tabsCollections.html",
                });
            }
        }],
    ]);

    for (const [id, menu] of menus.entries()) {
        browser.menus.create({
            id: id,
            title: menu.title,
            contexts: menu.contexts,
        });
    }

    browser.menus.onClicked.addListener((info) => {
        menus.get(info.menuItemId).onclick(info);
    });
});

browser.action.onClicked.addListener(async () => {
    async function getMostSpecificCollections(tab, collections) {
        const mostSpecificCollections = [];
        let mostSpecificRegexStability = Infinity;
        for (const collection of collections) {
            for (const filter of collection.filters) {
                let regexStability = await getRegexStability(filter, tab.url);
                if (regexStability === 0 || regexStability > mostSpecificRegexStability)
                    continue;
                if (regexStability < mostSpecificRegexStability) {
                    mostSpecificRegexStability = regexStability;
                    mostSpecificCollections.length = 0;
                }
                mostSpecificCollections.push(collection);
            }
        }
        return mostSpecificCollections;
    }

    const [collections, selectedTabs] = await Promise.all([
        Collection.getAll(),
        browser.tabs.query({ highlighted: true, currentWindow: true }),
    ]);
    const res = [];
    for (const tab of selectedTabs) {
        const mostSpecificCollections = await getMostSpecificCollections(tab, collections);
        if (mostSpecificCollections.length === 0)
            log.warn(`No matches found for ${tab.url}`);
        else if (mostSpecificCollections.length > 1)
            log.warn(`Multiple matches found for ${tab.url} : ${mostSpecificCollections.map(c => c.filters)}`);
        else {
            // TODO: notification API when added
            res.push({
                collectionId: mostSpecificCollections[0].id,
                url: tab.url,
                title: tab.title,
                favicon: tab.favIconUrl
            });
        }
    }
    Tab.bulkCreate(res);
});