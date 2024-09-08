"use strict";

import { Collection } from "./Collection.js";
import { ArrayExtensions } from "./extensions.js";
import { log } from "./globals.js";
import { getRegexStability } from "./regex.js";
import { Tab } from "./Tab.js";

browser.runtime.onInstalled.addListener(() => {
    // TODO: more menus: send and close, send all, send all and close, send to the left/right
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
                if (regexStability === 0 || regexStability > mostSpecificRegexStability || !filter.test(tab.url))
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
        let collectionId;
        const mostSpecificCollections = await getMostSpecificCollections(tab, collections);
        if (mostSpecificCollections.length === 0) {
            log.warn(`No matches found for ${tab.url}`);
            continue;
        }
        if (mostSpecificCollections.length > 1) {
            const highestPriorities = ArrayExtensions.getBiggestElements(mostSpecificCollections, (left, right) => left.priority - right.priority);
            if (highestPriorities.length > 1) {
                log.warn(`Multiple matches found for ${tab.url} : ${highestPriorities.map(c => c.filters)}`);
                continue;
            }
            collectionId = highestPriorities[0].id;
        }
        else {
            collectionId = mostSpecificCollections[0].id;
        }
        const collection = collections.find((c) => c.id === collectionId);
        if (!collection.allowDuplicates && collection.tabs.some((t) => t.url === tab.url)) {
            log.info(`%cTab ${tab.url} is already in ${collection.title}`, "color: #ffa500");
            continue;
        }
        res.push({
            collectionId: collectionId,
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl
        });
        log.info(`%cTab ${tab.url} added to ${collection.title}`, "color: Lime");
    }
    Tab.bulkCreate(res);
});