"use strict";

import { Collection } from "./Collection.js";
import { log } from "./globals.js";
import { OrphanTab, Tab } from "./Tab.js";

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
    const [collections, selectedTabs] = await Promise.all([
        Collection.getAll(),
        browser.tabs.query({ highlighted: true, currentWindow: true }),
    ]);
    const res = [];
    for (const tabObject of selectedTabs) {
        const tab = new OrphanTab(tabObject.url, tabObject.title, tabObject.favIconUrl);
        const matches = await tab.getMatches(collections);
        if (matches.length === 0 || matches.length > 1)
            continue;

        const collection = matches[0];
        if (!await collection.canAdd(tab)) {
            log.info(`%cTab ${tab.url} is already in ${collection.title}`, "color: #ffa500");
            continue;
        }

        tab.collectionId = collection.id;
        res.push(tab);
        // TODO: move the log after the tab was created, otherwise it's a bit misleading, the same with the other instance
        log.info(`%cTab ${tab.url} added to ${collection.title}`, "color: Lime");
    }
    Tab.bulkCreate(res);
});