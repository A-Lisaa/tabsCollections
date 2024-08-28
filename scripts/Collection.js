"use strict";

import { Tab } from "./Tab.js";
import { openDB } from "./db.js";

export class Collection {
    constructor(title, tabs = []) {
        this.title = title;
        this.tabs = tabs;
    }

    async save() {
        let db = await openDB();
        db.collections.put(await this.toObject(db));
    }

    static async load(name) {
        let db = await openDB();
        let object = await db.collections.get(name)
        return await Collection.fromObject(object, db);
    }

    async toObject(db) {
        return {
            title: this.title,
            tabs: await Promise.all(this.tabs.map(async (tab) => await tab.toObject(db))),
        };
    }

    static async fromPrompt() {
        let title = prompt("Enter the collection title:");
        if (!title) {
            return;
        }
        return new Collection(title);
    }

    static async fromObject(object, db) {
        return new Collection(
            object.title,
            await Promise.all(object.tabs.map(async (tab) => await Tab.fromObject(tab, db))),
        );
    }
}