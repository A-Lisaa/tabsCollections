"use strict";

import { Favicons } from "./Favicons.js";
import { db } from "./globals.js";
import { funcPerformance } from "./utility.js";

export class Tab {
    constructor(id, collectionId, url, title, favicon, creationTime = new Date()) {
        this.id = id;
        this.collectionId = collectionId;
        this.url = url;
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;

        //instancePerformance(this, this.title);
    }

    static async create(collectionId, url, title, favicon, creationTime = new Date(), returnNeeded = false) {
        let faviconHash;
        if (favicon !== undefined) {
            faviconHash = await Favicons.store(favicon);
        }
        const id = await db.tabs.add({
            collectionId: collectionId,
            url: url,
            title: title,
            faviconHash: faviconHash,
            creationTime: creationTime.getTime(),
        });
        if (!returnNeeded)
            return;
        return new Tab(id, collectionId, title, favicon, creationTime);
    }

    static async bulkCreate(tabs, returnNeeded = false) {
        const prepared = await Promise.all(tabs.map(async (tab) => {
            return {
                collectionId: tab.collectionId,
                url: tab.url,
                title: tab.title,
                faviconHash: (tab.favicon !== undefined) ? await Favicons.store(tab.favicon) : undefined,
                creationTime: (tab.creationTime ?? new Date()).getTime(),
            }
        }));
        if (!returnNeeded) {
            db.tabs.bulkAdd(prepared);
            return;
        }
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

    async toObject() {
        let faviconHash;
        if (this.favicon !== undefined) {
            faviconHash = await Favicons.store(this.favicon);
        }
        return {
            collectionId: this.collectionId,
            url: this.url,
            title: this.title,
            faviconHash: faviconHash,
            creationTime: this.creationTime.getTime(),
        };
    }

    async delete() {
        await db.tabs.delete(this.id);
        Favicons.cleanup();
    }

    static async deleteBulk(tabs) {
        await Promise.all(tabs.map((tab) => tab.delete()));
        Favicons.cleanup();
    }

    static {
        Tab["create"] = funcPerformance(Tab["create"], "Tab.create");
        Tab["bulkCreate"] = funcPerformance(Tab["bulkCreate"], "Tab.bulkCreate");
        Tab["faviconsCleanup"] = funcPerformance(Tab["faviconsCleanup"], "Tab.faviconsCleanup");
    }
}