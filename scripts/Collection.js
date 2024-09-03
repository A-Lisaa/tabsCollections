"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { Favicons } from "./Favicons.js";
import { db, log } from "./globals.js";
import { Settings } from "./Settings.js";
import { Tab } from "./Tab.js";
import { classPerformance, escapeRegex, instancePerformance } from "./utility.js";

export class Collection {
    constructor(id, title, filters, allowDuplicates, tabs = []) {
        this.id = id;
        this.title = title;
        this.filters = filters;
        this.allowDuplicates = allowDuplicates;
        this.tabs = tabs;

        instancePerformance(this, this.title);
    }

    static async create(title, filters) {
        const id = await db.collections.add({title: title, filters: filters});
        return new Collection(id, title, filters);
    }

    static async getTabs(collectionId) {
        const [favicons, tabsObjects] = await Promise.all([
            Favicons.getAll(),
            db.tabs.where({collectionId: collectionId}).toArray()
        ]);
        return Promise.all(tabsObjects.map((tabObject) => Tab.fromObject(tabObject, favicons)));
    }

    static async getAll() {
        const collections = await db.collections.toArray();
        return Promise.all(collections.map((collectionObject) => Collection.fromObject(collectionObject)));
    }

    static async fromObject(object) {
        const [tabs, filters] = await Promise.all([
            Collection.getTabs(object.id),
            Promise.all(
                object.filters.map(async (filter) => {
                    let regex;
                    if (filter.startsWith("/") && filter.endsWith("/")) {
                        // filter is a regex
                        regex = new RegExp(filter.slice(1, -1));
                    }
                    else {
                        regex = new RegExp(await escapeRegex(filter));
                    }
                    regex.original = filter;
                    return regex;
                })
            )
        ]);
        return new Collection(
            object.id,
            object.title,
            filters,
            tabs
        );
    }

    async getObservable() {
        return liveQuery(
            () => db.tabs.where({collectionId: this.id}).toArray()
        );
    }

    async delete() {
        db.collections.delete(this.id);
        log.info(`Deleted collection with id=${this.id} and title="${this.title}"`);
    }

    static {
        classPerformance(Collection, new Settings().performanceEnabled);
    }
}