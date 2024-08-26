"use strict";

import { Tab } from "./Tab.js";
import { openDB } from "./db.js";

export class Collection {
    constructor(title, tabs = [new Tab("foo"), new Tab("bar"), new Tab("baz")]) {
        this.title = title;
        this.tabs = tabs;
    }

    save() {
        let db = openDB();
        db.collections.put(this.toObject());
    }

    static load(name) {
        let db = openDB();
        return db.collections.get(name).then((collection) => Collection.fromObject(collection));
    }

    toObject() {
        return {
            title: this.title,
            tabs: this.tabs.map((tab) => tab.toObject()),
        };
    }

    static fromPrompt() {
        let title = prompt("Enter the collection title:");
        if (!title) {
            return;
        }
        return new Collection(title);
    }

    static fromObject(object) {
        return new Collection(
            object.title,
            object.tabs.map((tab) => Tab.fromObject(tab)),
        );
    }
}