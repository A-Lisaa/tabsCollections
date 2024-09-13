"use strict";

import { getRegexStability } from "../utility/regex.js";
import { Favicon } from "./Favicon.js";
import { db, log } from "./globals.js";

export class Tab {
    constructor(url, title, favicon = new Favicon(undefined), creationTime = new Date()) {
        // https://www.google.com/s2/favicons?domain=${DOMAIN}&sz=${SIZE}
        // use this when can't find the favicon in db
        this.id = undefined;  // Will be set when the tab is saved to the database.
        this.collectionId = undefined;
        this.url = decodeURI(url);
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;
    }

    #requiresId() {
        if (this.id === undefined) {
            throw new Error("Collection must have an ID to use this method");
        }
    }

    #requiresCollectionId() {
        if (this.collectionId === undefined) {
            throw new Error("Tab must have a collection ID to use this method");
        }
    }

    toDBObject() {
        this.#requiresCollectionId();
        return {
            collectionId: this.collectionId,
            url: this.url,
            title: this.title,
            faviconHash: this.favicon.hash,
            creationTime: this.creationTime.getTime(),
        }
    }

    async save() {
        this.#requiresCollectionId();
        this.id = await db.tabs.add(this.toDBObject());
    }

    async delete() {
        this.#requiresId();
        Tab.delete(this.id);
    }

    toJSON() {
        return {
            url: this.url,
            title: this.title,
            faviconHash: this.favicon.hash,
            creationTime: this.creationTime.getTime(),
        }
    }

    getMatches(collections) {
        const mostSpecificCollections = [];
        let mostSpecificRegexStability = Infinity;
        for (const collection of collections) {
            for (const filter of collection.filters) {
                let regexStability = getRegexStability(filter, this.url);
                if (regexStability === 0 || regexStability > mostSpecificRegexStability || !filter.test(this.url))
                    continue;
                if (regexStability < mostSpecificRegexStability) {
                    mostSpecificRegexStability = regexStability;
                    mostSpecificCollections.length = 0;
                }
                mostSpecificCollections.push(collection);
            }
        }

        if (mostSpecificCollections.length === 0) {
            log.warn(`No matches found for ${this.url}`);
            return mostSpecificCollections;
        }

        if (mostSpecificCollections.length === 1) {
            return mostSpecificCollections;
        }

        const highestPriorities = ArrayExtensions.getBiggestElements(mostSpecificCollections, (left, right) => left.priority - right.priority);
        if (highestPriorities.length > 1) {
            log.warn(`Multiple matches found for ${this.url} : ${highestPriorities.map((c) => c.filters)}`);
        }
        return highestPriorities;
    }

    static async getAll() {
        const tabsObjects = await db.tabs.toArray();
        return tabsObjects.map((tabObject) => Tab.fromDBObject(tabObject));
    }

    static async bulkSave(tabs) {
        const prepared = tabs.map((tab) => tab.toDBObject());
        const ids = await db.tabs.bulkAdd(prepared, undefined, { allKeys: true });
        for (let i = 0; i < tabs.length; i++) {
            tabs[i].id = ids[i];
        }
    }

    static async delete(id) {
        db.tabs.delete(id);
    }

    static async bulkDelete(ids) {
        db.tabs.bulkDelete(ids);
    }

    static fromDBObject(object) {
        const tab = new Tab(
            object.url,
            object.title,
            new Favicon(object.faviconHash),
            new Date(object.creationTime)
        );
        tab.id = object.id;
        tab.collectionId = object.collectionId;
        return tab;
    }

    static fromJSON(json) {
        return new Tab(
            json.url,
            json.title,
            new Favicon(json.faviconHash),
            new Date(json.creationTime)
        );
    }
}