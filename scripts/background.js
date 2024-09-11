"use strict";

import { Collection } from "./Collection.js";
import { Favicon } from "./Favicon.js";
import { Tab } from "./Tab.js";

async function sendTabs(selectedTabs) {
    const tabs = [];
    const favicons = await Favicon.bulkStore(selectedTabs.map((tab) => tab.favIconUrl));
    for (let i = 0; i < selectedTabs.length; i++) {
        let selectedTab = selectedTabs[i];
        const tab = new Tab(selectedTab.url, selectedTab.title, favicons[i]);
        tabs.push(tab);
    }
    Collection.addTabs(tabs);
}

browser.runtime.onInstalled.addListener(async () => {
    // TODO: force selected to...
    const menus = new Map([
        ["collectionsTabs", {
            title: "Collections Tabs",
            contexts: ["action"],
        }],
        ["showTabsCollectionsPage", {
            parentId: "collectionsTabs",
            title: "Show tabsCollections Page",
            contexts: ["action"],
            onclick: () => {
                browser.tabs.create({
                    active: true,
                    index: 0,
                    pinned: true,
                    url: "../pages/tabsCollections.html",
                });
            }
        }],
        ["separator1", {
            parentId: "collectionsTabs",
            type: "separator",
            contexts: ["action"],
        }],
        ["sendSelected", {
            parentId: "collectionsTabs",
            title: "Send selected",
            contexts: ["action"],
            onclick: async () => {
                const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
                sendTabs(selectedTabs);
            }
        }],
        ["sendAll", {
            parentId: "collectionsTabs",
            title: "Send all",
            contexts: ["action"],
            onclick: async () => {
                const tabs = await browser.tabs.query({ currentWindow: true });
                sendTabs(tabs);
            }
        }],
        ["separator2", {
            parentId: "collectionsTabs",
            type: "separator",
            contexts: ["action"],
        }],
        ["sendAndCloseSelected", {
            parentId: "collectionsTabs",
            title: "Send selected and close",
            contexts: ["action"],
            onclick: async () => {
                const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
                sendTabs(selectedTabs);
                await browser.tabs.remove(selectedTabs.map((tab) => tab.id));
            }
        }],
        ["sendAllAndClose", {
            parentId: "collectionsTabs",
            title: "Send all and close",
            contexts: ["action"],
            onclick: async () => {
                const tabs = await browser.tabs.query({ currentWindow: true });
                sendTabs(tabs);
                await browser.tabs.remove(tabs.map((tab) => tab.id));
            }
        }],
    ]);

    for (const [id, menu] of menus.entries()) {
        const properties = {id, ...menu};
        delete properties.onclick;
        await browser.menus.create(properties);
    }

    browser.menus.onClicked.addListener((info) => {
        Promise.resolve(menus.get(info.menuItemId).onclick());
    });
});

browser.action.onClicked.addListener(async () => {
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    sendTabs(selectedTabs);
});