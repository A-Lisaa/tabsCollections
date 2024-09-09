"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { md5 } from "../modules/md5.min.js";
import { resizeImage } from "../utility/utility.js";
import { db, log, settings } from "./globals.js";
import { classPerformance, funcPerformance } from "./profiler.js";

class FaviconCache {
    constructor() {
        this.data = new Map();
    }

    get size() {
        let size = 0;
        for (const image of this.data.values()) {
            size += typeof image === "string" ? (new Blob([image])).size : image.size;
        }
        return size;
    }

    async get(hash) {
        const image = this.data.get(hash);
        if (image === undefined) {
            return undefined;
        }
        return new Favicon(hash, image);
    }

    async bulkGet(hashes) {
        const favicons = [];
        for (const hash of hashes) {
            favicons.push(await this.get(hash));
        }
        return favicons;
    }
}

export class Favicon {
    #image;
    #url = null;

    constructor(hash, image) {
        this.hash = hash;
        this.#image = image;
    }

    get size() {
        if (typeof this.#image === "string")
            return (new Blob([this.#image])).size
        return this.#image.size;
    }

    get url() {
        if (typeof this.#image === "string")
            return this.#image;
        this.#url = URL.createObjectURL(this.#image);
        return this.#url;
    }

    release() {
        if (this.#url === null)
            return;
        URL.revokeObjectURL(this.#url);
        this.#url = null;
    }

    // #region Cache
    static #faviconsObservable;
    static cache = null;

    static #setCacheMethods() {
        Favicon.get = Favicon.cache.get.bind(Favicon.cache);
        Favicon.bulkGet = Favicon.cache.bulkGet.bind(Favicon.cache);
    }

    static {
        if (settings.cacheFavicons) {
            Favicon.cache = new FaviconCache();
            Favicon.#setCacheMethods();

            Favicon.#faviconsObservable = liveQuery(() => db.favicons.toArray());

            Favicon.#faviconsObservable.subscribe(funcPerformance(
                async (favicons) => {
                    Favicon.cache.data = await Favicon.mapHashToImage(favicons);
                    log.debug(`%cFavicons.cache size = ${Favicon.cache.size/1024} KB`, "color: #bada55;");
                },
                "Favicons observable"
            ));
        }
    }
    // #endregion Cache

    static convertDBImage(image) {
        if (typeof image === "string")
            // image is a string with a url
            return image;
        // image is an ArrayBuffer with image object
        return new Blob([image]);
    }

    static async mapHashToImage(favicons) {
        const map = new Map();
        for (const favicon of favicons) {
            map.set(favicon.hash, Favicon.convertDBImage(favicon.image));
        }
        return map;
   }

    static async get(hash) {
        const favicon = await db.favicons.get(hash);
        if (favicon === undefined)
            return undefined;
        return new Favicon(hash, Favicon.convertDBImage(favicon.image));
    }

    static async bulkGet(hashes) {
        const favicons = await db.favicons.bulkGet(hashes);
        return favicons.map((favicon) => favicon !== undefined ? new Favicon(favicon.hash, Favicon.convertDBImage(favicon.image)) : undefined);
    }

    static async getAll() {
        if (Favicon.cache !== null) {
            return Favicon.cache;
        }
        const cache = new FaviconCache();
        return cache.data = await Favicon.mapHashToImage(await db.favicons.toArray());
    }

    static async exists(hash) {
        return (await Favicon.get(hash)) !== undefined;
    }

    static async store(favicon) {
        if (favicon === undefined)
            return undefined;

        const hash = md5(favicon);

        if (await Favicon.exists(hash))
            return hash;

        if (favicon.startsWith("data:image")) {
            favicon = await resizeImage(favicon, settings.faviconsSize, settings.faviconsSize);
            favicon = await favicon.arrayBuffer();
        }

        db.favicons.add({ hash: hash, image: favicon });
        return hash;
    }

    static async bulkStore(favicons) {
        const results = [];
        const toStore = [];
        for (let favicon of favicons) {
            if (favicon === undefined) {
                results.push(undefined);
                continue;
            }

            const hash = md5(favicon);

            // the favicon has already been prepared for storing or already exists
            if (results.includes(hash) || await Favicon.exists(hash)) {
                results.push(hash);
                continue;
            }
            results.push(hash);

            if (favicon.startsWith("data:image")) {
                favicon = await resizeImage(favicon, settings.faviconsSize, settings.faviconsSize);
                favicon = await favicon.arrayBuffer();
            }

            toStore.push({ hash: hash, image: favicon });
        }
        db.favicons.bulkAdd(toStore);
        return results;
    }

    static async cleanup() {
        // TODO: I don't think this works, very low priority though
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

    static {
        classPerformance(Favicon);
    }
}