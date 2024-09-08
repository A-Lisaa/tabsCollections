"use strict";

import { Favicons } from "./Favicons.js";
import { db } from "./globals.js";
import { funcPerformance } from "./profiler.js";

export class Tab {
    constructor(id, collectionId, url, title, favicon, creationTime = new Date()) {
        this.id = id;
        this.collectionId = collectionId;
        this.url = url;
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;
    }

    static async create(collectionId, url, title, favicon, creationTime = new Date()) {
        let faviconHash;
        if (favicon !== undefined) {
            faviconHash = await Favicons.store(favicon);
        }
        const addition = db.tabs.add({
            collectionId: collectionId,
            url: url,
            title: title,
            faviconHash: faviconHash,
            creationTime: creationTime.getTime(),
        });
        return new Tab(await addition, collectionId, title, favicon, creationTime);
    }

    static async bulkCreate(tabs) {
        const hashes = await Favicons.bulkStore(tabs.map((tab) => tab.favicon));
        const prepared = await Promise.all(tabs.map(async (tab, index) => {
            tab.creationTime ??= new Date();
            return {
                collectionId: tab.collectionId,
                url: tab.url,
                title: tab.title,
                faviconHash: hashes[index],
                creationTime: tab.creationTime.getTime(),
            }
        }));
        const ids = await db.tabs.bulkAdd(prepared, undefined, { allKeys: true });
        return prepared.map((tab, index) => new Tab(ids[index], tab.collectionId, tab.url, tab.title, tabs[index].favicon, tab.creationTime));
    }

    static async fromObject(object, favicons) {
        // https://www.google.com/s2/favicons?domain=${DOMAIN}&sz=${SIZE}
        // use this when can't find the favicon in db
        return new Tab(
            object.id,
            object.collectionId,
            object.url,
            object.title,
            favicons.get(object.faviconHash),
            new Date(object.creationTime)
        );
    }

    static async getCollectionTabs(collectionId) {
        const [favicons, tabsObjects] = await Promise.all([
            Favicons.getAll(),
            db.tabs.where({collectionId: collectionId}).toArray()
        ]);
        return Promise.all(tabsObjects.map((tabObject) => Tab.fromObject(tabObject, favicons)));
    }

    static async delete(id) {
        db.tabs.delete(id);
    }

    static async bulkDelete(tabs) {
        db.tabs.bulkDelete(tabs.map((tab) => tab.id));
    }

    static {
        Tab["create"] = funcPerformance(Tab["create"], "Tab.create");
        Tab["bulkCreate"] = funcPerformance(Tab["bulkCreate"], "Tab.bulkCreate");
    }
}