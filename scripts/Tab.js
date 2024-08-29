"use strict";

import { db } from "./globals.js";
import { md5 } from "./md5.min.js";
import { funcPerformance } from "./utility.js";

async function storeFavicon(favicon) {
    let faviconHash = md5(favicon);
    await db.favicons.put({ hash: faviconHash, image: favicon });
    return faviconHash;
}

storeFavicon = funcPerformance(storeFavicon);

export class Tab {
    constructor(id, collectionId, url, title, favicon, creationTime = new Date()) {
        this.id = id;
        this.collectionId = collectionId;
        this.url = url;
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;

        //instancePerformance(this, this.title);
    }

    static async create(collectionId, url, title, favicon, creationTime = new Date()) {
        let faviconHash;
        if (favicon !== undefined) {
            faviconHash = await storeFavicon(favicon);
        }
        const id = await db.tabs.add({
            collectionId: collectionId,
            url: url,
            title: title,
            faviconHash: faviconHash,
            creationTime: creationTime.getTime(),
        });
        return new Tab(id, collectionId, title, favicon, creationTime);
    }

    static async fromObject(object, favicons) {
        // https://www.google.com/s2/favicons?domain=${DOMAIN}&sz=${SIZE}
        // use this when can't find the favicon in db
        return new Tab(
            object.id,
            object.collectionId,
            object.url,
            object.title,
            favicons.get(object.faviconHash),
            new Date(object.creationTime)
        );
    }

    async toObject() {
        let faviconHash;
        if (this.favicon !== undefined) {
            faviconHash = await storeFavicon(this.favicon);
        }
        return {
            collectionId: this.collectionId,
            url: this.url,
            title: this.title,
            faviconHash: faviconHash,
            creationTime: this.creationTime.getTime(),
        };
    }

    static {
        Tab["create"] = funcPerformance(Tab["create"], "Tab.create");
    }
}