"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { db } from "./globals.js";
import { Settings } from "./settings.js";
import { Tab } from "./Tab.js";
import { classPerformance, instancePerformance } from "./utility.js";

export class Collection {
    constructor(id, title, tabs = []) {
        this.id = id;
        this.title = title;
        this.tabs = tabs;

        instancePerformance(this, this.title);
    }

    static async create(title) {
        const id = await db.collections.add({title: title});
        return new Collection(id, title);
    }

    static async fromPrompt() {
        const title = prompt("Enter the collection title:");
        if (!title) {
            return;
        }
        return Collection.create(title);
    }

    static async getFavicons() {
        const favicons = new Map();
        await db.favicons.toCollection().each(({ hash, image }) => {
            favicons.set(hash, image);
        });
        return favicons;
    }

    static async getTabs(collectionId) {
        const favicons = await Collection.getFavicons();
        const tabsObjects = await db.tabs.where({collectionId: collectionId}).toArray();
        return Promise.all(tabsObjects.map((tabObject) => Tab.fromObject(tabObject, favicons)));
    }

    static async fromObject(object) {
        const tabs = await Collection.getTabs(object.id);
        return new Collection(
            object.id,
            object.title,
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

    async toObject() {
        return {
            title: this.title
        };
    }

    async save() {
        db.collections.put(await this.toObject());
    }

    static {
        classPerformance(Collection, Settings.load().performanceEnabled);
    }
}