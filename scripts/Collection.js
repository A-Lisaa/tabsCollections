"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { db } from "./globals.js";
import { classPerformance, instancePerformance } from "./profiler.js";
import { getRegexFromString } from "./regex.js";
import { Tab } from "./Tab.js";

export class Collection {
    constructor(id, title, filters, originalFilters, allowDuplicates, tabs = []) {
        this.id = id;
        this.title = title;
        this.filters = filters;
        this.originalFilters = originalFilters;
        this.allowDuplicates = allowDuplicates;
        this.tabs = tabs;

        instancePerformance(this, this.title);
    }

    static async create(title, filters, allowDuplicates, returnNeeded = false) {
        const addition = db.collections.add({title: title, filters: filters, allowDuplicates: allowDuplicates });
        if (!returnNeeded)
            return;
        return new Collection(await addition, title, filters, allowDuplicates);
    }

    static async fromObject(object) {
        const [tabs, filters] = await Promise.all([
            Tab.getCollectionTabs(object.id),
            Promise.all(object.filters.filter((filter) => !filter.trim().startsWith("#")).map((filter) => getRegexFromString(filter)))
        ]);
        return new Collection(
            object.id,
            object.title,
            filters,
            object.filters,
            object.allowDuplicates,
            tabs
        );
    }

    static async getAll() {
        const collections = await db.collections.toArray();
        return Promise.all(collections.map((collectionObject) => Collection.fromObject(collectionObject)));
    }

    static async fromDB(id) {
        const object = await db.collections.get(id);
        if (object === undefined) {
            console.warn(`Could not find collection with id ${id}`);
        }
        return Collection.fromObject(object);
    }

    static async delete(id) {
        db.tabs.where({ collectionId: id }).delete();
        db.collections.delete(id);
    }

    async getObservable() {
        const query = liveQuery(
            () => db.tabs.where({collectionId: this.id}).toArray()
        );
        query.collectionId = this.id;
        return query;
    }

    static {
        classPerformance(Collection);
    }
}