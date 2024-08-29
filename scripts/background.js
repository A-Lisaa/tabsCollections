"use strict";

import { Tab } from "./Tab.js";

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
    // for now assume we only want default and its id is 1
    const collectionTitle = "default";
    const collectionId = 1;
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    for (const tab of selectedTabs) {
        Tab.create(collectionId, tab.url, tab.title, tab.favIconUrl)
    }
});