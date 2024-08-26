"use strict";

import { Collection } from "./Collection.js";
import { Dexie } from "./dexie.min.js";

export function openDB() {
    const DBNAME = "tabsCollections";

    let db = new Dexie(DBNAME);

    db.version(1).stores({
        collections: "&title"
    });

    db.on("populate", () => {
        db.collections.add(new Collection("default"));
    });

    return db;
}