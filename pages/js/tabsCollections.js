"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { Collection } from "../../scripts/Collection.js";
import { Favicon } from "../../scripts/Favicon.js";
import { db } from "../../scripts/globals.js";
import { exportAsCollectionsJSON, exportAsTabsList, importAsCollectionsJSON, importAsTabsList } from "../../scripts/importExport.js";
import { funcPerformance } from "../../scripts/profiler.js";
import { Tab } from "../../scripts/Tab.js";

(async function() {
    //#region Utility
    // event = shown.bs.popover on element
    async function yesNoPopover(element, yes, no = (event) => {}) {
        new bootstrap.Popover(element);
        element.addEventListener("shown.bs.popover", (event) => {
            const popover = document.getElementById(event.target.attributes["aria-describedby"].value);
            const [buttonYes, buttonNo] = popover.querySelectorAll("a");
            buttonYes.addEventListener("click", () => {
                Promise.resolve(yes(event));
                element.click();
            });
            buttonNo.addEventListener("click", () => {
                Promise.resolve(no(event));
                element.click();
            });
        });
    }
    //#endregion

    //#region CollectionElement
    async function getCollectionElementTemplate() {
        // for now assume font size is always the same
        const fontSize = 8;
        const collectionElementTemplate = document.getElementById("collectionTemplate").cloneNode(true);
        collectionElementTemplate.removeAttribute("id");
        collectionElementTemplate.removeAttribute("aria-hidden");
        collectionElementTemplate.classList.remove("d-none");
        // width of creation time column
        collectionElementTemplate.querySelectorAll("th")[4].style = `width: ${new Date().toLocaleString().length * fontSize}px;`;
        collectionElementTemplate.querySelector("tbody").replaceChildren();
        return collectionElementTemplate;
    }

    async function getTabTemplate() {
        const tabTemplate = document.getElementById("tabTemplate").cloneNode(true);
        tabTemplate.removeAttribute("id");
        tabTemplate.removeAttribute("aria-hidden");
        tabTemplate.classList.remove("d-none");
        return tabTemplate;
    }

    const [tabTemplate, collectionElementTemplate] = await Promise.all([
        getTabTemplate(),
        getCollectionElementTemplate()
    ]);

    async function setCollectionElementText(collectionElement, parts = {
        title: undefined,
        size: undefined,
        priority: undefined
    }) {
        const [titleElement, sizeElement, priorityElement] = collectionElement.querySelector("button").children;
        titleElement.textContent = parts.title ?? titleElement.textContent;
        sizeElement.textContent = parts.size ?? sizeElement.textContent;
        priorityElement.textContent = parts.priority ?? priorityElement.textContent;
    }

    function getIdFromCollectionElement(element) {
        return parseInt(element.id.split("-")[1]);
    }

    async function setCollectionHeader(collection, { collectionHeader }) {
        const [collapseButton, deleteButton, clearButton, editButton] = collectionHeader.children;

        collapseButton.setAttribute("data-bs-target", `#collection-${collection.id}-subelements`);
        collapseButton.setAttribute("aria-controls", `collection-${collection.id}-subelements`);

        yesNoPopover(deleteButton, (event) => Collection.delete(getIdFromCollectionElement(event.target.parentNode.parentNode)));

        yesNoPopover(clearButton, (event) => Collection.clear(getIdFromCollectionElement(event.target.parentNode.parentNode)));

        editButton.addEventListener("click", async (event) => {
            const collectionElement = event.target.parentNode.parentNode;
            const collection = await Collection.fromDB(getIdFromCollectionElement(collectionElement));
            showCollectionModal(collectionElement, {
                modalTitle: `Collection ${collection.id}`,
                title: collection.title,
                filters: collection.originalFilters,
                priority: collection.priority,
                allowDuplicates: collection.allowDuplicates
            });
        });
    }

    function getIdFromTabElement(element) {
        return parseInt(element.id.split("-")[1]);
    }

    async function getTabElement(tab) {
        const row = tabTemplate.cloneNode(true);
        row.id = `tab-${tab.id}`;

        row.addEventListener("mouseenter", (event) => {
            event.target.querySelector("button").classList.remove("invisible");
        });
        row.addEventListener("mouseleave", (event) => {
            event.target.querySelector("button").classList.add("invisible");
        });

        const [closeButton, favicon, title, url, creationTime] = row.children;

        closeButton.firstElementChild.addEventListener("click", async (event) => Tab.delete(getIdFromTabElement(event.target.closest("tr"))));

        if (tab.favicon !== undefined) {
            try {
                favicon.firstElementChild.src = tab.favicon.url;
            }
            finally {
                tab.favicon.release();
            }
        }
        else {
            favicon.firstElementChild.src = "";
        }

        const titleAnchor = title.firstElementChild;
        titleAnchor.href = tab.url;
        titleAnchor.textContent = tab.title ?? "No title";
        // for the tooltip
        titleAnchor.setAttribute("data-bs-title", titleAnchor.textContent);
        new bootstrap.Tooltip(titleAnchor);

        const urlAnchor = url.firstElementChild;
        urlAnchor.href = tab.url;
        urlAnchor.textContent = tab.url;
        // for the tooltip
        urlAnchor.setAttribute("data-bs-title", tab.url);
        new bootstrap.Tooltip(urlAnchor);

        creationTime.textContent = tab.creationTime.toLocaleString();

        return row;
    }

    async function setCollectionSubelements(collection, { collectionSubelements }) {
        collectionSubelements.id = `collection-${collection.id}-subelements`;
    }

    async function getCollectionElement(collection) {
        const collectionElement = collectionElementTemplate.cloneNode(true);
        collectionElement.id = `collection-${collection.id}`;
        setCollectionElementText(collectionElement, { title: collection.title, size: collection.tabs.length, priority: collection.priority });

        const [collectionHeader, collectionSubelements] = collectionElement.children;
        setCollectionHeader(collection, { collectionHeader: collectionHeader });
        setCollectionSubelements(collection, { collectionSubelements: collectionSubelements });

        collectionElement.addEventListener("collectionUpdated", (event) => {
            db.collections.update(getIdFromCollectionElement(event.target), event.detail);
            setCollectionElementText(event.target, { title: event.detail.title, priority: event.detail.priority });
        });

        return collectionElement;
    }
    //#endregion

    //#region Observables
    const observables = new Map();

    async function createObservable(collection) {
        const observable = await collection.getObservable();
        observable.subscribe(funcPerformance(
            async (dbTabs) => {
                const collectionElement = document.getElementById(`collection-${observable.collectionId}`);
                if (collectionElement === null) {
                    return;
                }

                setCollectionElementText(collectionElement, { size: dbTabs.length });

                const tbody = collectionElement.querySelector("tbody");

                const pageTabs = [];
                const pageTabsIds = new Set();
                for (const tab of tbody.children) {
                    pageTabs.push(tab);
                    pageTabsIds.add(getIdFromTabElement(tab));
                }

                const dbTabsIds = new Set(dbTabs.map((tab) => tab.id));

                // tabs which are already in the db but not on the page yet
                const tabsToAddIds = dbTabsIds.difference(pageTabsIds);
                // tabs which are still on the page but not in the db already
                const tabsToRemoveIds = pageTabsIds.difference(dbTabsIds);

                const favicons = await Favicon.getAll();
                const tabsToAdd = await Promise.all(
                    dbTabs
                        .filter((tab) => tabsToAddIds.has(tab.id))
                        .map((tab) => Tab.fromDBObject(tab, favicons))
                );
                Promise.all(tabsToAdd.map(
                    async (tab) => {
                        tbody.append(await getTabElement(tab));
                    }
                ));

                const tabsToRemove = pageTabs.filter(
                    (tab) => tabsToRemoveIds.has(getIdFromTabElement(tab))
                );
                for (const tab of tabsToRemove)
                    tab.remove();
            },
            `Collection(${collection.title}) observer`
        ));
        observables.set(collection.id, observable);
    }

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe(funcPerformance(
        async (collections) => {
            const collectionsDiv = document.getElementById("collections");

            const pageCollections = [];
            const pageCollectionsIds = new Set();
            for (const collectionElement of collectionsDiv.children) {
                pageCollections.push(collectionElement);
                pageCollectionsIds.add(getIdFromCollectionElement(collectionElement));
            }

            const dbCollectionsIds = new Set(collections.map((collection) => collection.id));

            const collectionsToAddIds = dbCollectionsIds.difference(pageCollectionsIds);
            const collectionsToRemoveIds = pageCollectionsIds.difference(dbCollectionsIds);

            const collectionsToAdd = await Promise.all(
                collections
                    .filter((collection) => collectionsToAddIds.has(collection.id))
                    .map((collectionObject) => Collection.fromDBObject(collectionObject))
            );
            Promise.all(collectionsToAdd.map(async (collection) => {
                collectionsDiv.append(await getCollectionElement(collection));
                createObservable(collection);
            }));

            for (const collection of pageCollections) {
                const collectionId = getIdFromCollectionElement(collection);
                if (collectionsToRemoveIds.has(collectionId)) {
                    collection.remove();
                    observables.delete(collectionId);
                }
            }
        },
        `collectionsObservable observer`)
    );
    //#endregion

    //#region CollectionModal
    async function setCollectionModalData(data) {
        document.getElementById("collectionModalTitle").textContent = data.modalTitle;
        document.getElementById("collectionModalFormTitle").value = data.title;
        document.getElementById("collectionModalFormFilters").value = data.filters.join("\n");
        document.getElementById("collectionModalFormPriority").value = data.priority;
        document.getElementById("collectionModalFormAllowDuplicates").checked = data.allowDuplicates;
    }

    async function getCollectionModalData() {
        return {
            title: document.getElementById("collectionModalFormTitle").value.trim(),
            filters: document.getElementById("collectionModalFormFilters").value.trim().split("\n"),
            priority: document.getElementById("collectionModalFormPriority").value,
            allowDuplicates: document.getElementById("collectionModalFormAllowDuplicates").checked,
        };
    }

    async function showCollectionModal(collectionElement, collectionModalData) {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("collectionModal"));
        await setCollectionModalData({
            modalTitle: collectionModalData.modalTitle ?? "",
            title: collectionModalData.title ?? "",
            filters: collectionModalData.filters ?? [],
            priority: collectionModalData.priority ?? 0,
            allowDuplicates: collectionModalData.allowDuplicates ?? false,
        });
        document.getElementById("collectionModalForm").addEventListener("submit", async () => {
            const collectionData = await getCollectionModalData();
            if (collectionElement === undefined) {
                document.getElementById("collections").dispatchEvent(
                    new CustomEvent("collectionCreated", {
                        detail: collectionData,
                    })
                );
            }
            else {
                collectionElement.dispatchEvent(
                    new CustomEvent("collectionUpdated", {
                        detail: collectionData,
                    })
                );
            }
            modal.hide();
        });
        modal.show();
    }
    //#endregion

    async function addFormsValidation() {
        const forms = document.querySelectorAll(".needs-validation")

        for (const form of forms) {
            form.addEventListener("submit", (event) => {
                if (!event.target.checkValidity()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                event.target.classList.add("was-validated");
            });
        }
    }

    async function addHandlers() {
        document.getElementById("createCollectionButton").addEventListener("click", () => {
            showCollectionModal(undefined, { modalTitle: "Create Collection" });
        });
        document.getElementById("hideCollectionsButton").addEventListener("click", () => {
            const collapses = document.getElementById("collections").querySelectorAll(".collapse");
            for (const collapse of collapses) {
                bootstrap.Collapse.getOrCreateInstance(collapse).hide();
            }
        });
        document.getElementById("showCollectionsButton").addEventListener("click", () => {
            const collapses = document.getElementById("collections").querySelectorAll(".collapse");
            for (const collapse of collapses) {
                bootstrap.Collapse.getOrCreateInstance(collapse).show();
            }
        });

        document.getElementById("importButton").addEventListener("click", () => {
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("importModal"));
            modal.show();
        });
        document.getElementById("importModal").querySelector("form").addEventListener("submit", async () => {
            const asTabsList = document.getElementById("importModalTypeTabsList").checked;
            const asCollectionsJSON = document.getElementById("importModalTypeCollectionsJSON").checked;
            const input = document.getElementById("importModalTextarea").value;
            if (asTabsList)
                await importAsTabsList(input.split("\n"));
            else if (asCollectionsJSON)
                await importAsCollectionsJSON(input);
            const modal = bootstrap.Modal.getInstance(document.getElementById("importModal"));
            modal.hide();
        });
        document.getElementById("importModal").addEventListener("hidden.bs.modal", async (event) => {
            const form = event.target.querySelector("form");
            form.reset();
        });

        document.getElementById("exportModalTypeTabsList").addEventListener("click", async () => {
            const output = document.getElementById("exportModalTextarea");
            output.value = await exportAsTabsList();
        });
        document.getElementById("exportModalTypeCollectionsJSON").addEventListener("click", async () => {
            const output = document.getElementById("exportModalTextarea");
            output.value = await exportAsCollectionsJSON();
        });
        document.getElementById("exportModal").addEventListener("hidden.bs.modal", async () => {
            document.getElementById("exportModalTextarea").value = "";
        });

        document.getElementById("collections").addEventListener("collectionCreated", (event) => {
            Collection.create(event.detail);
        });

        document.getElementById("collectionModal").addEventListener("hidden.bs.modal", (event) => {
            let form = document.getElementById("collectionModalForm");
            // clear the form
            form.reset();
            form.classList.remove("was-validated");
            // replace the form with its clone to remove all listeners
            const newForm = form.cloneNode(true)
            form.replaceWith(newForm);
            form = newForm;
            // add validation listener back
            form.addEventListener("submit", (event) => {
                if (!event.target.checkValidity()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                event.target.classList.add("was-validated");
            });
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                Favicon.cleanup();
            }
        });
    }

    async function main() {
        addHandlers();
        addFormsValidation();
    }

    document.addEventListener("DOMContentLoaded", main);
})();