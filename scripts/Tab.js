"use strict";

import { md5 } from "./md5.js";

export class Tab {
    constructor(url, title, favicon, creationTime = new Date()) {
        this.url = url;
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;
    }

    async toObject(db) {
        let faviconHash;
        if (this.favicon !== undefined) {
            faviconHash = md5(this.favicon);
            await db.favicons.put({ hash: faviconHash, image: this.favicon });
        }
        return {
            url: this.url,
            title: this.title,
            faviconHash: faviconHash,
            creationTime: this.creationTime.getTime(),
        };
    }

    static async fromObject(object, db) {
        // https://www.google.com/s2/favicons?domain=${DOMAIN}&sz=${SIZE}
        // use this when can't find the favicon in db
        let favicon;
        if (object.faviconHash !== undefined) {
            let imageObject = await db.favicons.get(object.faviconHash);
            if (imageObject !== undefined) {
                favicon = imageObject.image;
            }
            else {
                console.warn(`Favicon with hash ${object.faviconHash} for ${object.url} not found. Database might have been corrupted.`);
            }
        }
        return new Tab(
            object.url,
            object.title,
            favicon,
            new Date(object.creationTime)
        );
    }
}