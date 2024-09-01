"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { Favicons } from "./Favicons.js";
import { db } from "./globals.js";
import { Settings } from "./settings.js";
import { Tab } from "./Tab.js";
import { classPerformance, escapeRegExp, instancePerformance } from "./utility.js";

export class Collection {
    constructor(id, title, filters, tabs = []) {
        this.id = id;
        this.title = title;
        this.filters = filters;
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
                    if (filter.startsWith("/") && filter.endsWith("/")) {
                        return new RegExp(filter.slice(1, -1));
                    }
                    return new RegExp(await escapeRegExp(filter));
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

    static async fromDB(id) {
        const object = await db.collections.get(id);
        if (object === undefined) {
            console.warn(`Could not find collection with id ${id}`);
        }
        return Collection.fromObject(object);
    }

    async getObservable() {
        return liveQuery(
            () => db.tabs.where({collectionId: this.id}).toArray()
        );
    }

    async delete() {
        db.collections.delete(this.id);
    }

    static {
        classPerformance(Collection, Settings.load().performanceEnabled);
    }
}