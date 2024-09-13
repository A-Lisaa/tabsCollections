"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { md5 } from "../modules/md5.min.js";
import { resizeImage } from "../utility/utility.js";
import { db, log, settings } from "./globals.js";

export class Favicon {
    #url = null;

    constructor(hash) {
        this.hash = hash;
    }

    get url() {
        if (this.hash === undefined)
            return "";
        const image = Favicon.get(this.hash);
        if (typeof image === "string")
            return image;
        this.#url = URL.createObjectURL(image);
        return this.#url;
    }

    release() {
        if (this.#url === null)
            return;
        URL.revokeObjectURL(this.#url);
        this.#url = null;
    }

    // #region Cache
    static #faviconsObservable = liveQuery(() => db.favicons.toArray());
    static #cache = new Map();

    static get cacheSize() {
        let size = 0;
        for (const image of Favicon.#cache.values()) {
            size += typeof image === "string" ? (new Blob([image])).size : image.size;
        }
        return size;
    }

    static {
        Favicon.#faviconsObservable.subscribe((favicons) => {
            for (const favicon of favicons) {
                Favicon.#cache.set(favicon.hash, Favicon.convertDBImage(favicon.image));
            }
            log.debug(`%cFavicons.cache size = ${Favicon.cacheSize/1024} KB`, "color: #bada55;");
        });
    }
    // #endregion Cache

    static convertDBImage(image) {
        if (typeof image === "string")
            // image is a string with a url
            return image;
        // image is an ArrayBuffer with image object
        return new Blob([image]);
    }

    static get(hash) {
        return Favicon.#cache.get(hash);
    }

    static exists(hash) {
        return Favicon.get(hash) !== undefined;
    }

    static async store(favicon) {
        if (favicon === undefined)
            return new Favicon(undefined);

        const hash = md5(favicon);

        if (Favicon.exists(hash))
            return new Favicon(hash);

        if (favicon.startsWith("data:image")) {
            favicon = resizeImage(favicon, 16, 16);
            favicon = await favicon.arrayBuffer();
        }

        db.favicons.add({ hash: hash, image: favicon });
        return new Favicon(hash);
    }

    static async bulkStore(favicons) {
        const results = [];
        const toStore = [];
        for (let favicon of favicons) {
            if (favicon === undefined) {
                results.push(new Favicon(undefined));
                continue;
            }

            const hash = md5(favicon);

            // the favicon has already been prepared for storing or already exists
            if ((results.find((result) => result.hash === hash) !== undefined) || Favicon.exists(hash)) {
                results.push(new Favicon(hash));
                continue;
            }


            if (favicon.startsWith("data:image")) {
                favicon = await resizeImage(favicon, 16, 16);
                favicon = await favicon.arrayBuffer();
            }

            toStore.push({ hash: hash, image: favicon });
            results.push(new Favicon(hash));
        }
        db.favicons.bulkAdd(toStore);
        return results;
    }

    static async cleanup() {
        // TODO: Low priority: I don't think this works
        return;
        const lastCleanup = new Date(JSON.parse(localStorage.getItem("lastFaviconsCleanup")));
        if (new Date() - lastCleanup < settings.faviconsCleanupFrequency)
            return;

        db.transaction("rw", db.tabs, db.favicons, async () => {
            const [tabs, favicons] = await Promise.all([
                db.tabs.toArray(),
                db.favicons.toArray(),
            ]);
            const hashes = new Set(tabs.map((tab) => tab.faviconHash));
            const toDelete = favicons.filter((favicon) => !hashes.has(favicon));
            console.log(await db.favicons.bulkDelete(toDelete));
        });

        localStorage.setItem("lastFaviconsCleanup", JSON.stringify(new Date()));
        log.info("%cFavicons cleanup ran", "color: #ff66cc");
    }
}