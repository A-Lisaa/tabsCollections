"use strict";

import { Collection } from "./Collection.js";
import { OrphanTab, Tab } from "./Tab.js";
import { db, log } from "./globals.js";

export async function importAsTabsList(tabs) {
    const res = [];
    const collections = await Collection.getAll();
    for (const tabString of tabs) {
        const [url, title] = tabString.split("|");
        const tab = new OrphanTab(url.trim(), title !== undefined ? title.trim() : undefined);

        const matches = await tab.getMatches(collections);
        if (matches.length === 0 || matches.length > 1)
            continue;

        const collection = matches[0];
        if (!await collection.canAdd(tab)) {
            log.info(`%cTab ${tab.url} is already in ${collection.title}`, "color: #ffa500");
            continue;
        }

        res.push({ collectionId: collection.id, url: tab.url, title: tab.title });
        log.info(`%cTab ${tab.url} added to ${collection.title}`, "color: Lime");
    }
    Tab.bulkCreate(res);
}

export async function importAsCollectionsJSON(json) {
    const collections = JSON.parse(json);
    for (const collection of collections) {
        Collection.fromJSON(collection);
    }
}

export async function exportAsTabsList() {
    let res = "";
    const tabs = await db.tabs.toArray();
    for (const tab of tabs) {
        res += `${tab.url} | ${tab.title}\n`;
    }
    return res;
}

export async function exportAsCollectionsJSON() {
    const res = [];
    const collections = await Collection.getAll();
    for (const collection of collections) {
        res.push(collection);
    }
    return JSON.stringify(res, null, 2);
}