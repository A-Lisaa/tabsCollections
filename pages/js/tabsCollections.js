"use strict";

import { Collection } from "../../scripts/Collection.js";
import { Favicons } from "../../scripts/Favicons.js";
import { Tab } from "../../scripts/Tab.js";
import { liveQuery } from "../../scripts/dexie.min.js";
import { db } from "../../scripts/globals.js";
import { funcPerformance } from "../../scripts/utility.js";

(async function() {
    async function getCollectionElementTemplate() {
        // for now assume font size is always the same
        const fontSize = 8;
        const collectionElementTemplate = document.getElementById("collectionTemplate").cloneNode(true);
        collectionElementTemplate.removeAttribute("id");
        collectionElementTemplate.removeAttribute("aria-hidden");
        collectionElementTemplate.classList.remove("d-none");
        // width of creation time column
        collectionElementTemplate.querySelectorAll("th")[4].style = `width: ${new Date().toLocaleString().length * fontSize}px;`;
        return collectionElementTemplate;
    }

    async function getTabTemplate() {
        const tabTemplate = document.getElementById("tabTemplate").cloneNode(true);
        tabTemplate.removeAttribute("id");
        tabTemplate.removeAttribute("aria-hidden");
        tabTemplate.classList.remove("d-none");
        tabTemplate.addEventListener("mouseenter", (event) => {
            event.target.querySelector(".btn-close").classList.remove("invisible");
        });
        tabTemplate.addEventListener("mouseleave", (event) => {
            event.target.querySelector(".btn-close").classList.add("invisible");
        });
        return tabTemplate;
    }

    const collectionElementTemplate = await getCollectionElementTemplate();
    const tabTemplate = await getTabTemplate();

    async function setCollectionHeader(collection, { collectionHeader }) {
        const [collapseButton, deleteButton, editButton] = collectionHeader.children;

        collapseButton.setAttribute("data-bs-target", `#collection-${collection.id}-subelements`);
        collapseButton.setAttribute("aria-controls", `collection-${collection.id}-subelements`);
        collapseButton.textContent = `${collection.title} | ${collection.tabs.length} tab(s)`;

        new bootstrap.Popover(deleteButton);
        deleteButton.addEventListener("shown.bs.popover", async (event) => {
            // TODO: popovers are very unreliable, need a way to always get the one that opened
            const popover = document.getElementById(event.target.attributes["aria-describedby"].value);
            const [deleteButtonYes, deleteButtonNo] = popover.querySelectorAll("a");
            deleteButtonYes.addEventListener("click", async () => {
                await collection.delete();
                deleteButton.click();
            });
            deleteButtonNo.addEventListener("click", () => { deleteButton.click() });
        });

        editButton.addEventListener("click", () => {});
    }
    setCollectionHeader = funcPerformance(setCollectionHeader);

    async function getCollectionRow(tab) {
        const row = tabTemplate.cloneNode(true);
        row.setAttribute("tab-id", tab.id);
        const [closeButton, favicon, title, url, creationTime] = row.children;

        closeButton.children[0].addEventListener("click", async () => {
            await tab.delete();
        });

        favicon.children[0].src = tab.favicon ?? '';

        const titleAnchor = title.children[0];
        titleAnchor.href = tab.url;
        titleAnchor.textContent = tab.title ?? "No title";
        titleAnchor.setAttribute("data-bs-title", titleAnchor.textContent);
        new bootstrap.Tooltip(titleAnchor);

        const urlAnchor = url.children[0];
        urlAnchor.href = tab.url;
        urlAnchor.textContent = decodeURI(tab.url);
        urlAnchor.setAttribute("href", tab.url);
        new bootstrap.Tooltip(urlAnchor);

        creationTime.textContent = tab.creationTime.toLocaleString();

        return row;
    }

    async function setCollectionTbody(tabs, tbody) {
        Promise.all(
            tabs.map(
                (tab) => getCollectionRow(tab).then((row) => { tbody.append(row); })
            )
        );
    }
    setCollectionTbody = funcPerformance(setCollectionTbody);

    async function setCollectionSubelements(collection, { collectionSubelements }) {
        collectionSubelements.id = `collection-${collection.id}-subelements`;
        const tbody = collectionSubelements.querySelector("tbody");
        setCollectionTbody(collection.tabs, tbody);
    }
    setCollectionSubelements = funcPerformance(setCollectionSubelements);

    async function getCollectionElement(collection) {
        const collectionElement = collectionElementTemplate.cloneNode(true);
        collectionElement.setAttribute("collection-id", collection.id);

        const [collectionHeader, collectionSubelements] = collectionElement.children;
        setCollectionHeader(collection, { collectionHeader: collectionHeader });
        setCollectionSubelements(collection, { collectionSubelements: collectionSubelements });

        return collectionElement;
    }
    getCollectionElement = funcPerformance(getCollectionElement);

    async function showCollectionTabs(collectionId, tabs) {
        const div = document.getElementById("collections").querySelector(`div[collection-id="${collectionId}"]`);
        const collapser = div.querySelector("button");
        collapser.textContent = `${collapser.textContent.split(" | ")[0]} | ${tabs.length} tab(s)`;

        const tbody = div.querySelector("tbody");
        tbody.innerHTML = "";
        setCollectionTbody(tabs, tbody);
    }
    showCollectionTabs = funcPerformance(showCollectionTabs);

    const observables = new Map();

    async function showCollection(collection) {
        const observable = await collection.getObservable();
        observable.subscribe({
            next: funcPerformance(
                async (result) => {
                    const favicons = await Favicons.getAll();
                    const tabs = await Promise.all(result.map((tab) => Tab.fromObject(tab, favicons)));
                    await showCollectionTabs(collection.id, tabs);
                },
                `Collection(${collection.title}) observer`
            )
        });
        observables.set(collection.id, observable);
        const collectionDiv = await getCollectionElement(collection);
        document.getElementById("collections").append(collectionDiv);
    }
    showCollection = funcPerformance(showCollection);

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe({
        next: funcPerformance(
            async (collections) => {
                observables.clear();
                document.getElementById("collections").innerHTML = "";
                Promise.all(collections.map(async (collectionObject) => {
                    const collection = await Collection.fromObject(collectionObject);
                    showCollection(collection);
                }));
            },
            `collectionsObservable observer`)
    });

    async function createCollection() {
        document.getElementById("collectionModalSaveButton").addEventListener("click", () => {
            const title = document.getElementById("collectionModalTitle").value.trim();
            const filters = document.getElementById("collectionModalFilters").value.trim().split("\n");
            Collection.create(title, filters);
        });
    }

    async function addHandlers() {
        document.getElementById("createCollection").addEventListener("click", createCollection);
    }

    async function main() {
        await addHandlers();
    }

    document.addEventListener("DOMContentLoaded", main);
})();