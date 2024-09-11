"use strict";

import { Collection } from "./Collection.js";
import { Tab } from "./Tab.js";
import { db } from "./globals.js";

export async function importAsTabsList(tabsStrings) {
    const tabs = [];
    for (const tabString of tabsStrings) {
        const [url, title] = tabString.split("|");
        const tab = new Tab(
            url.trim(),
            title !== undefined ? title.trim() : url.trim()
        );
        tabs.push(tab);
    }
    Collection.addTabs(tabs);
}

export async function importAsCollectionsJSON(json) {
    Promise.all(json.map(async (JSONCollection) => {
        let collection = Collection.fromJSON(JSONCollection);
        const equalCollection = await collection.getFirstEqualCollection();
        if (equalCollection === undefined)
            await collection.save();
        else
            collection = equalCollection;

        const tabs = JSONCollection.tabs.map((tab) => Tab.fromJSON(tab));
        await collection.addTabs(tabs);
    }));
}

export async function exportAsTabsList() {
    let result = "";
    const tabs = await db.tabs.toArray();
    for (const tab of tabs) {
        result += `${tab.url} | ${tab.title}\n`;
    }
    return result;
}

export async function exportAsCollectionsJSON() {
    const result = [];
    const collections = await Collection.getAll();
    for (const collection of collections) {
        result.push(collection);
    }
    return JSON.stringify(result, null, 2);
}