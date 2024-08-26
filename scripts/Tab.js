"use strict";

export class Tab {
    constructor(url, title, favicon, creationTime = new Date()) {
        this.url = url;
        this.title = title;
        this.favicon = favicon;
        this.creationTime = creationTime;
    }

    save(db) {
        let tx = db.transaction(["collections"], "readwrite");
        let store = tx.objectStore("collections");
        let request = store.add(this);
        request.onerror = (event) => {
            console.error(event);
        };
    }

    toObject() {
        return {
            url: this.url,
            title: this.title,
            favicon: this.favicon,
            creationTime: this.creationTime.getTime(),
        };
    }

    static fromObject(object) {
        return new Tab(
            object.url,
            object.title,
            object.favicon,
            new Date(object.creationTime)
        );
    }
}