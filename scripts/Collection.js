"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { getRegexFromString } from "../utility/regex.js";
import { db } from "./globals.js";
import { classPerformance, instancePerformance } from "./profiler.js";
import { OrphanTab, Tab } from "./Tab.js";

export class Collection {
    constructor(id, title, filters, originalFilters, priority, allowDuplicates, tabs = []) {
        this.id = id;
        this.title = title;
        this.filters = filters;
        this.originalFilters = originalFilters;
        this.priority = priority;
        this.allowDuplicates = allowDuplicates;
        this.tabs = tabs;

        instancePerformance(this, this.title);
    }

    async getObservable() {
        const query = liveQuery(
            () => db.tabs.where({collectionId: this.id}).toArray()
        );
        query.collectionId = this.id;
        return query;
    }

    async canAdd(tab) {
        return this.allowDuplicates || !this.tabs.some((t) => t.url === tab.url);
    }

    async asTabsList() {
        const res = "";
        for (const tab of this.tabs) {
            res += `${tab.url} | ${tab.title}\n`;
        }
        return res;
    }

    toJSON() {
        return {
            title: this.title,
            filters: this.originalFilters,
            priority: this.priority,
            allowDuplicates: this.allowDuplicates,
            tabs: this.tabs
        };
    }

    async populateFromTabsList(tabs) {
        const res = [];
        for (const tabString of tabs) {
            const [url, title] = tabString.split("|");
            const tab = new OrphanTab(url.trim(), title !== undefined ? title.trim() : undefined);
            if (!await this.canAdd(tab)) {
                log.info(`%cTab ${tab.url} is already in ${this.title}`, "color: #ffa500");
                continue;
            }
            res.push({ collectionId: this.id, url: tab.url, title: tab.title });
            log.info(`%cTab ${tab.url} added to ${this.title}`, "color: Lime");
        }
        Tab.bulkCreate(res);
    }

    static async fromDBObject(object) {
        const [tabs, filters] = await Promise.all([
            Tab.getCollectionTabs(object.id),
            Promise.all(object.filters.filter((filter) => !filter.trim().startsWith("#")).map((filter) => getRegexFromString(filter)))
        ]);
        return new Collection(
            object.id,
            object.title,
            filters,
            object.filters,
            object.priority,
            object.allowDuplicates,
            tabs
        );
    }

    // data = {title, filters, priority, allowDuplicates}
    static async create(data) {
        data.id = await db.collections.add(data);
        return Collection.fromDBObject(data);
    }

    static async fromJSON(json) {
        // TODO: behaviour when the collection exists and/or has duplicates
        const collection = await Collection.create({
            title: json.title,
            filters: json.filters,
            priority: json.priority,
            allowDuplicates: json.allowDuplicates
        });
        Tab.bulkFromJSON(json.tabs.map((tab) => {
            return {
                collectionId: collection.id,
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon,
                creationTime: tab.creationTime
            }
        }));
        return collection;
    }

    static async fromDB(id) {
        const object = await db.collections.get(id);
        if (object === undefined) {
            console.warn(`Could not find collection with id ${id}`);
        }
        return Collection.fromDBObject(object);
    }

    static async getAll() {
        const collections = await db.collections.toArray();
        return Promise.all(collections.map((collectionObject) => Collection.fromDBObject(collectionObject)));
    }

    static async clear(id) {
        db.tabs.where({ collectionId: id }).delete();
    }

    static async delete(id) {
        Collection.clear(id);
        db.collections.delete(id);
    }

    static {
        classPerformance(Collection);
    }
}