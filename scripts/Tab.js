"use strict";

import { getRegexStability } from "../utility/regex.js";
import { Favicon } from "./Favicon.js";
import { db, log } from "./globals.js";
import { funcPerformance } from "./profiler.js";

export class Tab {
    constructor(id, collectionId, url, title, favicon, creationTime = new Date()) {
        this.id = id;
        this.collectionId = collectionId;
        this.url = decodeURI(url);
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;
    }

    async getMatches(collections) {
        const mostSpecificCollections = [];
        let mostSpecificRegexStability = Infinity;
        for (const collection of collections) {
            for (const filter of collection.filters) {
                let regexStability = await getRegexStability(filter, this.url);
                if (regexStability === 0 || regexStability > mostSpecificRegexStability || !filter.test(this.url))
                    continue;
                if (regexStability < mostSpecificRegexStability) {
                    mostSpecificRegexStability = regexStability;
                    mostSpecificCollections.length = 0;
                }
                mostSpecificCollections.push(collection);
            }
        }

        if (mostSpecificCollections.length <= 1) {
            if (mostSpecificCollections.length === 0)
                log.warn(`No matches found for ${this.url}`);
            return mostSpecificCollections;
        }

        const highestPriorities = ArrayExtensions.getBiggestElements(mostSpecificCollections, (left, right) => left.priority - right.priority);
        if (highestPriorities.length > 1) {
            log.warn(`Multiple matches found for ${this.url} : ${highestPriorities.map((c) => c.filters)}`);
        }
        return highestPriorities;
    }

    toJSON() {
        return {
            url: this.url,
            title: this.title,
            creationTime: this.creationTime.getTime(),
        }
    }

    // data = {collectionId, url, title, favicon, creationTime}
    static async create(data) {
        data.creationTime ??= new Date();
        let faviconHash;
        if (data.favicon !== undefined) {
            faviconHash = await Favicon.store(data.favicon);
        }
        const addition = db.tabs.add({
            collectionId: data.collectionId,
            url: decodeURI(data.url),
            title: data.title,
            faviconHash: data.faviconHash,
            creationTime: data.creationTime.getTime(),
        });
        return new Tab(await addition, data.collectionId, data.title, data.favicon, data.creationTime);
    }

    static async bulkCreate(tabs) {
        const hashes = await Favicon.bulkStore(tabs.map((tab) => tab.favicon));
        const prepared = await Promise.all(tabs.map(async (tab, index) => {
            tab.creationTime ??= new Date();
            return {
                collectionId: tab.collectionId,
                url: decodeURI(tab.url),
                title: tab.title,
                faviconHash: hashes[index],
                creationTime: tab.creationTime.getTime(),
            }
        }));
        const ids = await db.tabs.bulkAdd(prepared, undefined, { allKeys: true });
        return prepared.map((tab, index) => new Tab(ids[index], tab.collectionId, tab.url, tab.title, tabs[index].favicon, tab.creationTime));
    }

    static async fromJSON(json) {
        // https://www.google.com/s2/favicons?domain=${DOMAIN}&sz=${SIZE}
        // use this when can't find the favicon in db
        return Tab.create({
            collectionId: json.collectionId,
            url: json.url,
            title: json.title,
            creationTime: new Date(json.creationTime),
        });
    }

    static async bulkFromJSON(json) {
        return Tab.bulkCreate(json.map((tab) => {
            return {
                collectionId: tab.collectionId,
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon,
                creationTime: new Date(tab.creationTime)
            }
        }));
    }

    static async fromDBObject(object, favicons) {
        return new Tab(
            object.id,
            object.collectionId,
            object.url,
            object.title,
            await favicons.get(object.faviconHash),
            new Date(object.creationTime)
        );
    }

    static async getCollectionTabs(collectionId) {
        const [favicons, tabsObjects] = await Promise.all([
            Favicon.getAll(),
            db.tabs.where({collectionId: collectionId}).toArray()
        ]);
        return Promise.all(tabsObjects.map((tabObject) => Tab.fromDBObject(tabObject, favicons)));
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

export class OrphanTab extends Tab {
    constructor(url, title, favicon, creationTime = new Date()) {
        super(null, null, url, title, favicon, creationTime);
    }
}