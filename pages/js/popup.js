"use strict";

import { Collection } from "../../scripts/Collection.js";
import { Tab } from "../../scripts/Tab.js";

(function() {
    function openPage() {
        let createData = {
            active: true,
            index: 0,
            pinned: true,
            url: "./tabsCollections.html",
        };

        let creating = browser.tabs.create(createData);
    }

    async function sendSelected() {
        let collection = await Collection.load("default");
        let selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
        for (let tab of selectedTabs) {
            let t = new Tab(tab.url, tab.title, tab.favIconUrl);
            collection.tabs.push(t);
            //browser.runtime.sendMessage({ url: tab.url, title: tab.title, favicon: tab.favIconUrl });
        }
        console.log(collection);
        collection.save();
    }

    function addHandlers() {
        document.getElementById("openPage").addEventListener("click", openPage);
        document.getElementById("sendSelected").addEventListener("click", sendSelected);
    }

    function main() {
        addHandlers();
    }

    document.addEventListener("DOMContentLoaded", main);
})();