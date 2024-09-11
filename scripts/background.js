"use strict";

import { Collection } from "./Collection.js";
import { Favicon } from "./Favicon.js";
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
    const tabs = [];
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const favicons = await Favicon.bulkStore(selectedTabs.map((tab) => tab.favIconUrl));
    for (let i = 0; i < selectedTabs.length; i++) {
        let selectedTab = selectedTabs[i];
        const tab = new Tab(selectedTab.url, selectedTab.title, favicons[i]);
        tabs.push(tab);
    }
    Collection.addTabs(tabs);
});