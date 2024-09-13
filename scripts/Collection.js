"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { getRegexFromString } from "../utility/regex.js";
import { db, log } from "./globals.js";
import { instancePerformance } from "./profiler.js";
import { Tab } from "./Tab.js";

export class Collection {
    constructor(title, filters, priority, allowDuplicates, tabs = []) {
        this.id = undefined; // will be set when the collection is saved to the database
        this.title = title;
        this.filters = filters
            .filter((filter) => !filter.trim().startsWith("#"))
            .map((filter) => getRegexFromString(filter));
        this.originalFilters = filters;
        this.priority = priority;
        this.allowDuplicates = allowDuplicates;
        this.tabs = tabs;

        instancePerformance(this, this.title);
    }

    #requiresId() {
        if (this.id === undefined) {
            throw new Error("Collection must have an ID to use this method");
        }
    }

    toDBObject() {
        return {
            title: this.title,
            filters: this.originalFilters,
            priority: this.priority,
            allowDuplicates: this.allowDuplicates
        };
    }

    async save() {
        if (this.id === undefined) {
            this.id = await db.collections.add(this.toDBObject());
            return;
        }
        db.collections.update(this.id, this.toDBObject());
    }

    async clear() {
        this.#requiresId();
        Collection.clear(this.id);
    }

    async delete() {
        this.#requiresId();
        Collection.delete(this.id);
    }

    // as* methods return a string representation of the collection in different formats

    asTabsList() {
        let result = "";
        for (const tab of this.tabs) {
            result += `${tab.url} | ${tab.title}\n`;
        }
        return result;
    }

    asTabsJSON() {
        return JSON.stringify(this.tabs, null, 2);
    }

    asJSON() {
        // it's an array so that common import can handle it
        return JSON.stringify([this], null, 2);
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

    equals(other) {
        return this.title === other.title &&
            this.filters.length === other.filters.length &&
            this.filters.every((filter, index) => filter.source === other.filters[index].source) &&
            this.priority === other.priority &&
            this.allowDuplicates === other.allowDuplicates;
    }

    async getFirstEqualCollection() {
        const allCollections = await Collection.getAll(false);
        return allCollections.find((c) => this.equals(c));
    }

    canAdd(tab) {
        if (!this.allowDuplicates && this.tabs.some((t) => t.url === tab.url))
            return [false, `Tab ${tab.url} is already in ${this.title}`];
        if (!this.filters.some((filter) => filter.test(tab.url)))
            return [false, `Tab ${tab.url} doesn't match any of the ${this.title}'s filters`];
        return [true];
    }

    async addTab(tab) {
        this.#requiresId();
        const [canAdd, reason] = this.canAdd(tab);
        if (!canAdd) {
            log.info(`%c${reason}`, "color: #ffa500");
            return;
        }
        tab.collectionId = this.id;
        await tab.save();
        this.tabs.push(tab);
        log.info(`%cTab ${tab.url} added to ${this.title}`, "color: Lime");
    }

    async addTabs(tabs) {
        this.#requiresId();
        const tabsToAdd = [];
        for (const tab of tabs) {
            const [canAdd, reason] = this.canAdd(tab);
            if (!canAdd) {
                log.info(`%c${reason}`, "color: #ffa500");
                continue;
            }

            tab.collectionId = this.id;
            this.tabs.push(tab);
            tabsToAdd.push(tab);
        }
        await Tab.bulkSave(tabsToAdd);
        for (const tab of tabsToAdd)
            log.info(`%cTab ${tab.url} added to collection ${this.title}`, "color: Lime");
    }

    async populateFromDB() {
        this.#requiresId();
        const tabsObjects = await db.tabs.where({ collectionId: this.id }).toArray();
        const tabs = tabsObjects.map((tabObject) => Tab.fromDBObject(tabObject));
        this.tabs = this.tabs.concat(tabs);
    }

    populateFromTabsList(tabsStrings) {
        const tabs = [];
        for (const tabString of tabsStrings) {
            const [url, title] = tabString.split("|");
            const tab = new Tab(
                url.trim(),
                title !== undefined ? title.trim() : url.trim()
            );
            tabs.push(tab);
        }
        this.addTabs(tabs);
    }

    populateFromTabsJSON(json) {
        const tabs = json.map((tab) => Tab.fromJSON(tab));
        this.addTabs(tabs);
    }

    getObservable() {
        this.#requiresId();
        const observable = liveQuery(() => db.tabs.where({collectionId: this.id}).toArray());
        observable.collectionId = this.id;
        return observable;
    }

    static fromDBObject(object) {
        const collection = new Collection(
            object.title,
            object.filters,
            object.priority,
            object.allowDuplicates
        );
        collection.id = object.id;
        return collection;
    }

    static fromJSON(json) {
        return new Collection(
            json.title,
            json.filters,
            json.priority,
            json.allowDuplicates
        );
    }

    static async get(id, populate = true) {
        const object = await db.collections.get(id);
        if (object === undefined) {
            console.warn(`Could not find collection with id ${id}`);
            return undefined;
        }
        const collection = Collection.fromDBObject(object);
        if (populate)
            await collection.populateFromDB();
        return collection;
    }

    static async getAll(populate = true) {
        const collectionsObjects = await db.collections.toArray();
        const collections = collectionsObjects.map((collection) => Collection.fromDBObject(collection));
        if (populate) {
            for (const collection of collections) {
                await collection.populateFromDB();
            }
        }
        return collections;
    }

    static async addTab(tab) {
        const collections = await Collection.getAll();

        const matches = tab.getMatches(collections);
        if (matches.length === 0 || matches.length > 1)
            return;

        const collection = matches[0];
        collection.addTab(tab);
    }

    static async addTabs(tabs) {
        const collections = await Collection.getAll();

        const tabsToAdd = [];
        for (const tab of tabs) {
            const matches = tab.getMatches(collections);
            if (matches.length === 0 || matches.length > 1)
                continue;

            const collection = matches[0];
            if (!collection.canAdd(tab)) {
                log.info(`%cTab ${tab.url} is already in ${collection.title}`, "color: #ffa500");
                continue;
            }

            tab.collectionId = collection.id;
            collection.tabs.push(tab);
            tabsToAdd.push(tab);
        }
        await Tab.bulkSave(tabsToAdd);
        for (const tab of tabsToAdd)
            log.info(`%cTab ${tab.url} added to collection with id = ${tab.collectionId}`, "color: Lime");
    }

    static async clear(id) {
        db.tabs.where({ collectionId: id }).delete();
    }

    static async delete(id) {
        Collection.clear(id);
        db.collections.delete(id);
    }
}