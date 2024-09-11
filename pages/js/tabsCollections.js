"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { Collection } from "../../scripts/Collection.js";
import { db } from "../../scripts/globals.js";
import { exportAsCollectionsJSON, exportAsTabsList, importAsCollectionsJSON, importAsTabsList } from "../../scripts/importExport.js";
import { funcPerformance } from "../../scripts/profiler.js";
import { Tab } from "../../scripts/Tab.js";

(async function() {
    //#region Utility
    // event = shown.bs.popover on element
    function yesNoPopover(element, yes, no = (event) => {}) {
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
    function getCollectionElementTemplate() {
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

    function getTabTemplate() {
        const tabTemplate = document.getElementById("tabTemplate").cloneNode(true);
        tabTemplate.removeAttribute("id");
        tabTemplate.removeAttribute("aria-hidden");
        tabTemplate.classList.remove("d-none");
        return tabTemplate;
    }

    const tabTemplate = getTabTemplate();
    const collectionElementTemplate = getCollectionElementTemplate();

    function setCollectionElementText(collectionElement, parts = {
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

    function setCollectionHeader(collection, collectionHeader) {
        const [collapseButton, deleteButton, clearButton, editButton] = collectionHeader.children;

        collapseButton.setAttribute("data-bs-target", `#collection-${collection.id}-subelements`);
        collapseButton.setAttribute("aria-controls", `collection-${collection.id}-subelements`);

        yesNoPopover(deleteButton, (event) => Collection.delete(getIdFromCollectionElement(event.target.parentNode.parentNode)));

        yesNoPopover(clearButton, (event) => Collection.clear(getIdFromCollectionElement(event.target.parentNode.parentNode)));

        // TODO: change the collection's elements after edit
        editButton.addEventListener("click", async (event) => {
            const collectionElement = event.target.parentNode.parentNode;
            const collection = await Collection.get(getIdFromCollectionElement(collectionElement), false);
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

    function getTabElement(tab) {
        const row = tabTemplate.cloneNode(true);
        row.id = `tab-${tab.id}`;

        row.addEventListener("mouseenter", (event) => {
            event.target.querySelector("button").classList.remove("invisible");
        });
        row.addEventListener("mouseleave", (event) => {
            event.target.querySelector("button").classList.add("invisible");
        });

        const [closeButton, favicon, title, url, creationTime] = row.children;

        closeButton.firstElementChild.addEventListener("click", (event) => Tab.delete(getIdFromTabElement(event.target.closest("tr"))));

        try {
            favicon.firstElementChild.src = tab.favicon.url;
        }
        finally {
            tab.favicon.release();
        }

        const titleAnchor = title.firstElementChild;
        titleAnchor.href = tab.url;
        titleAnchor.textContent = tab.title ?? "No title";
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

    function setCollectionSubelements(collection, collectionSubelements) {
        collectionSubelements.id = `collection-${collection.id}-subelements`;
    }

    function getCollectionElement(collection) {
        const collectionElement = collectionElementTemplate.cloneNode(true);
        collectionElement.id = `collection-${collection.id}`;
        setCollectionElementText(collectionElement, { title: collection.title, size: collection.tabs.length, priority: collection.priority });

        const [collectionHeader, collectionSubelements] = collectionElement.children;
        setCollectionHeader(collection, collectionHeader);
        setCollectionSubelements(collection, collectionSubelements);

        collectionElement.addEventListener("collectionUpdated", (event) => {
            db.collections.update(getIdFromCollectionElement(event.target), event.detail);
            setCollectionElementText(event.target, { title: event.detail.title, priority: event.detail.priority });
        });

        return collectionElement;
    }
    //#endregion

    //#region Observables
    // ! Observables shouldn't make any changes to the db, they're read-only
    const observables = new Map();

    function createObservable(collection) {
        const observable = collection.getObservable();
        observable.subscribe(funcPerformance(
            (dbTabs) => {
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

                const tabsToAdd = dbTabs
                    .filter((tab) => tabsToAddIds.has(tab.id))
                    .map((tab) => Tab.fromDBObject(tab));
                tbody.append(...tabsToAdd.map((tab) => getTabElement(tab)));

                const tabsToRemove = pageTabs
                    .filter((tab) => tabsToRemoveIds.has(getIdFromTabElement(tab)));
                for (const tab of tabsToRemove)
                    tab.remove();
            },
            `Collection(${collection.title}) observer`
        ));
        observables.set(collection.id, observable);
    }

    const collectionsObservable = liveQuery(() => db.collections.toArray());

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

            const collectionsToAdd = collections
                .filter((collection) => collectionsToAddIds.has(collection.id))
                .map((collectionObject) => Collection.fromDBObject(collectionObject));
            for (const collection of collectionsToAdd) {
                collectionsDiv.append(getCollectionElement(collection));
                createObservable(collection);
            }

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
    function setCollectionModalData(data) {
        document.getElementById("collectionModalTitle").textContent = data.modalTitle;
        document.getElementById("collectionModalFormTitle").value = data.title;
        document.getElementById("collectionModalFormFilters").value = data.filters.join("\n");
        document.getElementById("collectionModalFormPriority").value = data.priority;
        document.getElementById("collectionModalFormAllowDuplicates").checked = data.allowDuplicates;
    }

    function getCollectionModalData() {
        return {
            title: document.getElementById("collectionModalFormTitle").value.trim(),
            filters: document.getElementById("collectionModalFormFilters").value.trim().split("\n"),
            priority: document.getElementById("collectionModalFormPriority").value,
            allowDuplicates: document.getElementById("collectionModalFormAllowDuplicates").checked,
        };
    }

    function showCollectionModal(collectionElement, collectionModalData) {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("collectionModal"));

        let form = document.getElementById("collectionModalForm");
        // clear the form
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

        setCollectionModalData({
            modalTitle: collectionModalData.modalTitle ?? "",
            title: collectionModalData.title ?? "",
            filters: collectionModalData.filters ?? [],
            priority: collectionModalData.priority ?? 0,
            allowDuplicates: collectionModalData.allowDuplicates ?? false,
        });
        document.getElementById("collectionModalForm").addEventListener("submit", async () => {
            const collectionData = getCollectionModalData();
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

    //#region ImportExport
    async function getImportTypeTemplate() {
        const el = document.getElementById("importModalTypeTemplate").cloneNode(true);
        el.removeAttribute("id");
        el.classList.remove("d-none");
        return el;
    }
    const importTypeTemplate = await getImportTypeTemplate();

    async function showImportModal(types) {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("importModal"));
        const typesElement = document.getElementById("importModalTypes");
        const typesElements = [];
        for (const [typeName, typeAction] of types.entries()) {
            let typeElement = importTypeTemplate.cloneNode(true);
            typeElement.textContent = typeName;
            typeElement.addEventListener("click", () => {
                const input = document.getElementById("importModalTextarea").value;
                Promise.resolve(typeAction(input));
                modal.hide();
            });
            typesElements.push(typeElement);
        }
        typesElement.replaceChildren(...typesElements);
        document.getElementById("importModalTextarea").value = "";
        modal.show();
    }

    async function getExportTypeTemplate() {
        const el = document.getElementById("exportModalTypeTemplate").cloneNode(true);
        el.removeAttribute("id");
        el.classList.remove("d-none");
        return el;
    }
    const exportTypeTemplate = await getExportTypeTemplate();

    async function showExportModal(types) {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("exportModal"));
        const typesElement = document.getElementById("exportModalTypes");
        const typesElements = [];
        for (const [typeName, typeAction] of types.entries()) {
            let typeElement = exportTypeTemplate.cloneNode(true);
            typeElement.textContent = typeName;
            typeElement.addEventListener("click", () => {
                Promise.resolve(typeAction());
            });
            typesElements.push(typeElement);
        }
        typesElement.replaceChildren(...typesElements);
        document.getElementById("exportModalTextarea").value = "";
        modal.show();
    }
    //#endregion

    function addHandlers() {
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
            showImportModal(new Map([
                ["Tabs List", async (input) => {
                    await importAsTabsList(input.trim().split("\n"));
                }],
                ["Collections JSON", async (input) => {
                    await importAsCollectionsJSON(JSON.parse(input));
                }]
            ]));
        });

        document.getElementById("exportButton").addEventListener("click", () => {
            showExportModal(new Map([
                ["Tabs List", async () => {
                    document.getElementById("exportModalTextarea").value = await exportAsTabsList();
                }],
                ["Collections JSON", async () => {
                    document.getElementById("exportModalTextarea").value = await exportAsCollectionsJSON();
                }]
            ]));
        });

        document.getElementById("collections").addEventListener("collectionCreated", async (event) => {
            const data = event.detail;
            const collection = new Collection(data.title, data.filters, data.priority, data.allowDuplicates);
            await collection.save();
        });

        // document.addEventListener("visibilitychange", () => {
        //     if (document.hidden) {
        //         Favicon.cleanup();
        //     }
        // });
    }

    function main() {
        addHandlers();
    }

    document.addEventListener("DOMContentLoaded", main);
})();