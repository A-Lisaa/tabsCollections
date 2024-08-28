"use strict";

import { Collection } from "./Collection.js";
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
    let collection = await Collection.load("default");
    let selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    for (let tab of selectedTabs) {
        let t = new Tab(tab.url, tab.title, tab.favIconUrl);
        collection.tabs.push(t);
    }
    await collection.save();
});