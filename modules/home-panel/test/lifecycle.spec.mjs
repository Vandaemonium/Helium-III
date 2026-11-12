import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildHomePanelPackage } from "../scripts/build-package.mjs";
import { EtapiClientAdapter, HomePanelLifecycleManager } from "../scripts/lifecycle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const HomePanelQueries = require("../src/HomePanelQueries.js");

/**
 * Synthetic in-memory Helium-III / Trilium note graph implementing the adapter contract
 * plus frontend `api` methods used by `HomePanelQueries` and `HomePanelRoot.jsx`.
 */
class SyntheticHeliumStore {
    constructor() {
        this.notes = new Map();
        this.attributes = new Map();
        this.nextId = 1;
        this.deleted = [];

        this.seedSystemNote("root", "root", "book");
        this.seedSystemNote("_hidden", "Hidden Subtree", "book", "root");
    }

    seedSystemNote(noteId, title, type, parentNoteId = null) {
        this.notes.set(noteId, {
            noteId,
            title,
            type,
            mime: "text/html",
            content: "",
            parentNoteIds: parentNoteId ? [parentNoteId] : [],
            childNoteIds: [],
            blobId: `blob_${noteId}`,
            isProtected: false,
            isArchived: false,
            utcDateModified: "2026-11-12 00:00:00.000Z",
            dateModified: "2026-11-12 00:00:00.000-0500"
        });
        if (parentNoteId && this.notes.has(parentNoteId)) {
            this.notes.get(parentNoteId).childNoteIds.push(noteId);
        }
    }

    getNoteAttributes(noteId) {
        const list = [];
        for (const attr of this.attributes.values()) {
            if (attr.noteId === noteId) {
                list.push({ ...attr });
            }
        }
        return list;
    }

    async createNote({ parentNoteId, title, type, mime = "text/html", content = "", utcDateModified, isProtected = false }) {
        // Mirrors getAndValidateParent() in packages/trilium-core/src/services/notes.ts.
        if (parentNoteId === "_hidden") throw new Error("Creating child notes into '_hidden' is not allowed.");
        const noteId = `note_${this.nextId++}`;
        const ts = utcDateModified || `2026-11-12 03:${String(this.nextId).padStart(2, "0")}:00.000Z`;
        const note = {
            noteId,
            title,
            type,
            mime,
            content,
            parentNoteIds: [parentNoteId],
            childNoteIds: [],
            blobId: `blob_${noteId}`,
            isProtected,
            isArchived: false,
            utcDateModified: ts,
            dateModified: ts
        };
        this.notes.set(noteId, note);
        const parent = this.notes.get(parentNoteId);
        if (parent) {
            parent.childNoteIds.push(noteId);
        }
        return this.serializeNote(note);
    }

    async createAttribute({ noteId, type, name, value = "" }) {
        const attributeId = `attr_${this.nextId++}`;
        const attr = { attributeId, noteId, type, name, value };
        this.attributes.set(attributeId, attr);
        return { ...attr };
    }

    async deleteAttribute(attributeId) {
        this.attributes.delete(attributeId);
    }

    /** Recursive like the server's BNote.deleteNote(), but the lifecycle must never need that. */
    async deleteNote(noteId) {
        const note = this.notes.get(noteId);
        if (!note) return;
        assert.deepEqual(note.childNoteIds, [], "delete must never rely on cascading");
        this.deleted.push(noteId);
        this.cascadeDelete(noteId);
    }

    cascadeDelete(noteId) {
        const note = this.notes.get(noteId);
        if (!note) return;
        for (const childId of [...note.childNoteIds]) this.cascadeDelete(childId);
        for (const pId of note.parentNoteIds) {
            const p = this.notes.get(pId);
            if (p) {
                p.childNoteIds = p.childNoteIds.filter((id) => id !== noteId);
            }
        }
        for (const [attrId, attr] of this.attributes.entries()) {
            if (attr.noteId === noteId || (attr.type === "relation" && attr.value === noteId)) {
                this.attributes.delete(attrId);
            }
        }
        this.notes.delete(noteId);
    }

    async allNotes() {
        return [...this.notes.values()].map((n) => this.serializeNote(n));
    }

    async getNote(noteId) {
        const note = this.notes.get(noteId);
        if (!note) throw new Error(`Note ${noteId} not found`);
        return this.serializeNote(note);
    }

    async getNoteContent(noteId) {
        const note = this.notes.get(noteId);
        if (!note) throw new Error(`Note ${noteId} not found`);
        return note.content;
    }

    async updateNoteContent(noteId, newContent) {
        const note = this.notes.get(noteId);
        if (!note) throw new Error(`Note ${noteId} not found`);
        note.content = newContent;
    }

    isInHidden(noteId) {
        const visited = new Set();
        const stack = [noteId];
        while (stack.length > 0) {
            const cur = stack.pop();
            if (cur === "_hidden") return true;
            if (visited.has(cur)) continue;
            visited.add(cur);
            const n = this.notes.get(cur);
            if (n) {
                stack.push(...n.parentNoteIds);
            }
        }
        return false;
    }

    serializeNote(note) {
        return {
            noteId: note.noteId,
            title: note.title,
            type: note.type,
            mime: note.mime,
            blobId: note.blobId,
            isProtected: note.isProtected,
            attributes: this.getNoteAttributes(note.noteId),
            parentNoteIds: [...note.parentNoteIds],
            childNoteIds: [...note.childNoteIds],
            utcDateModified: note.utcDateModified
        };
    }

    async searchNotes(query) {
        const all = [...this.notes.values()];
        // Match #label="value"
        const exactMatch = query.match(/^#([a-zA-Z0-9_:-]+)="([^"]*)"$/);
        if (exactMatch) {
            const [, labelName, labelVal] = exactMatch;
            return all
                .filter((n) =>
                    this.getNoteAttributes(n.noteId).some(
                        (a) => a.type === "label" && a.name === labelName && a.value === labelVal
                    )
                )
                .map((n) => this.serializeNote(n));
        }

        // Match #label
        const tagMatch = query.match(/^#([a-zA-Z0-9_:-]+)$/);
        if (tagMatch) {
            const [, labelName] = tagMatch;
            return all
                .filter((n) =>
                    this.getNoteAttributes(n.noteId).some((a) => a.type === "label" && a.name === labelName)
                )
                .map((n) => this.serializeNote(n));
        }

        // Recent query
        if (query.startsWith("note.noteId != 'root'")) {
            return all
                .filter((n) => n.noteId !== "root")
                .sort((a, b) => b.utcDateModified.localeCompare(a.utcDateModified))
                .map((n) => this.serializeNote(n));
        }

        return [];
    }

    /**
     * Builds a frontend `FNote`-compatible wrapper for `HomePanelQueries`.
     */
    toFrontendFNote(noteId) {
        const note = this.notes.get(noteId);
        if (!note) return null;
        const attrs = this.getNoteAttributes(noteId);
        const store = this;
        return {
            noteId: note.noteId,
            title: note.title,
            type: note.type,
            mime: note.mime,
            isArchived: Boolean(note.isArchived),
            isProtected: Boolean(note.isProtected),
            hasOwnedLabel(name) {
                return attrs.some((a) => a.type === "label" && a.name === name);
            },
            isInHiddenSubtree() {
                return store.isInHidden(note.noteId);
            },
            hasChildren() {
                return note.childNoteIds.length > 0;
            },
            async getChildNotes() {
                return note.childNoteIds.map((id) => store.toFrontendFNote(id)).filter(Boolean);
            },
            async getJsonContent() {
                try {
                    return JSON.parse(note.content);
                } catch {
                    return null;
                }
            },
            async getMetadata() {
                return {
                    utcDateModified: note.utcDateModified,
                    dateModified: note.dateModified
                };
            },
            getIcon() {
                return note.type === "render" ? "tn-icon bx bx-layout" : "tn-icon bx bx-note";
            }
        };
    }

    createFrontendApi() {
        const store = this;
        return {
            async searchForNotes(query) {
                const raw = await store.searchNotes(query);
                return raw.map((r) => store.toFrontendFNote(r.noteId)).filter(Boolean);
            },
            async searchForNote(query) {
                const notes = await this.searchForNotes(query);
                return notes[0] || null;
            }
        };
    }
}

describe("Helium-III Module 1: empyrean.home-panel v0.1.0", () => {
    it("builds a valid deterministic note-subtree ZIP package with manifest metadata", () => {
        const { zipPath, zipBuffer, metaFile, entries } = buildHomePanelPackage(MODULE_DIR);
        assert.ok(fs.existsSync(zipPath), "ZIP artifact should exist on disk");
        assert.ok(zipBuffer.length > 200, "ZIP buffer should be non-empty");
        assert.equal(zipBuffer.readUInt32LE(0), 0x04034b50, "ZIP starts with PK\\x03\\x04 signature");
        assert.equal(metaFile.formatVersion, 2);
        assert.equal(metaFile.heliumModuleManifest.moduleId, "empyrean.home-panel");
        assert.equal(metaFile.heliumModuleManifest.version, "0.1.0");
        assert.equal(entries.length, 4);
    });

    it("executes the full 5-stage lifecycle while preserving user notes and configuration", async () => {
        const store = new SyntheticHeliumStore();
        const manager = new HomePanelLifecycleManager(store, MODULE_DIR);

        // Seed user data: a pinned note, an inbox folder with a child note, and a regular note
        const pinnedNote = await store.createNote({
            parentNoteId: "root",
            title: "Project Roadmap",
            type: "text",
            content: "<p>Key milestones</p>",
            utcDateModified: "2026-11-12 03:10:00.000Z"
        });
        await store.createAttribute({
            noteId: pinnedNote.noteId,
            type: "label",
            name: "pinned",
            value: ""
        });

        const inboxFolder = await store.createNote({
            parentNoteId: "root",
            title: "Inbox",
            type: "book",
            content: "",
            utcDateModified: "2026-11-12 03:11:00.000Z"
        });
        await store.createAttribute({
            noteId: inboxFolder.noteId,
            type: "label",
            name: "inbox",
            value: ""
        });

        const inboxItem = await store.createNote({
            parentNoteId: inboxFolder.noteId,
            title: "Quick thought on Helium-III",
            type: "text",
            content: "<p>Test module 1</p>",
            utcDateModified: "2026-11-12 03:12:00.000Z"
        });

        // Stage 1: Inert install
        const installRes = await manager.install();
        assert.equal(installRes.status, "installed-inert");
        assert.equal(installRes.ownedCodeNoteIds.length, 3);
        assert.equal(installRes.configPreserved, false);

        // Verify duplicate install is rejected unless replaceExisting/upgrade is used
        await assert.rejects(() => manager.install(), /already installed/);

        // Verify Home host note has `disabled:renderNote` (inert) and NOT active `renderNote`
        const hostAfterInstall = await store.getNote(installRes.homeHostNoteId);
        assert.ok(
            hostAfterInstall.attributes.some(
                (a) => a.type === "relation" && a.name === "disabled:renderNote" && a.value === installRes.entryJsxNoteId
            ),
            "Home host note must have ~disabled:renderNote after inert install"
        );
        assert.ok(
            !hostAfterInstall.attributes.some((a) => a.type === "relation" && a.name === "renderNote"),
            "Home host note must NOT have active ~renderNote before activation"
        );

        // Stage 2: Explicit activation
        const activateRes = await manager.activate();
        assert.equal(activateRes.status, "active");
        const hostAfterActivate = await store.getNote(installRes.homeHostNoteId);
        const activeRels = hostAfterActivate.attributes.filter(
            (a) => a.type === "relation" && a.name === "renderNote"
        );
        assert.equal(activeRels.length, 1);
        assert.equal(activeRels[0].value, installRes.entryJsxNoteId);

        // Verify HomePanelQueries reads user notes and excludes system/module notes
        const frontendApi = store.createFrontendApi();
        const panelData = await HomePanelQueries.loadHomePanelData(frontendApi);
        assert.equal(panelData.configNoteId, installRes.configNoteId);
        assert.equal(panelData.pinned.length, 1);
        assert.equal(panelData.pinned[0].title, "Project Roadmap");
        assert.ok(panelData.inbox.some((i) => i.title === "Quick thought on Helium-III"));
        assert.ok(
            !panelData.recent.some((r) => r.title === "HomePanelRoot" || r.title === "HomePanelQueries"),
            "Module code notes must be excluded from Recent Notes"
        );

        // Customize user config note (e.g. recentLimit = 3)
        await store.updateNoteContent(
            installRes.configNoteId,
            JSON.stringify({ schemaVersion: 1, recentLimit: 3, pinnedLabel: "pinned", inboxLabel: "inbox" }, null, 2)
        );

        // Stage 3: Disable
        const disableRes = await manager.disable();
        assert.equal(disableRes.status, "disabled");
        const hostAfterDisable = await store.getNote(installRes.homeHostNoteId);
        assert.ok(
            !hostAfterDisable.attributes.some((a) => a.type === "relation" && a.name === "renderNote"),
            "Active ~renderNote must be removed when disabled"
        );
        assert.ok(
            hostAfterDisable.attributes.some(
                (a) => a.type === "relation" && a.name === "disabled:renderNote"
            ),
            "~disabled:renderNote must be retained when disabled"
        );

        // Stage 4: Code-only uninstall, only with an approved plan and maintenance confirmation
        await assert.rejects(() => manager.upgrade(), /approval/i);
        const plan = await manager.planUninstall();
        assert.equal(plan.noteIds.length, 3);
        await assert.rejects(() => manager.uninstall("not-consent", { maintenanceConfirmed: true }), /approval/i);
        await assert.rejects(() => manager.uninstall(plan.approvalHash), /maintenance/i);
        assert.equal(store.deleted.length, 0);
        const uninstallRes = await manager.uninstall(plan.approvalHash, { maintenanceConfirmed: true });
        assert.equal(uninstallRes.status, "uninstalled-code-only");
        assert.equal(uninstallRes.removedCodeNoteIds.length, 3);
        assert.equal((await manager.findOwnedCodeNotes()).length, 0, "All module code notes must be removed");

        // Verify user notes and custom configuration survived uninstall untouched
        assert.ok(!(await store.getNote(installRes.homeHostNoteId)).attributes.some((a) => a.type === "relation"));
        const retainedConfigContent = JSON.parse(await store.getNoteContent(installRes.configNoteId));
        assert.equal(retainedConfigContent.recentLimit, 3, "User custom config must survive code-only uninstall");
        const survivingPinned = await store.getNote(pinnedNote.noteId);
        assert.equal(survivingPinned.title, "Project Roadmap");
        const survivingInboxItem = await store.getNote(inboxItem.noteId);
        assert.equal(survivingInboxItem.title, "Quick thought on Helium-III");

        // Stage 5: Reinstall / upgrade reconnects to retained config without duplicating notes or relations
        const reinstallRes = await manager.upgrade({ activateAfterUpgrade: true });
        assert.equal(reinstallRes.status, "upgraded-and-active");
        assert.equal(reinstallRes.configPreserved, true, "Reinstall must preserve existing user config note");
        assert.equal(reinstallRes.configNoteId, installRes.configNoteId);
        assert.equal(reinstallRes.homeHostNoteId, installRes.homeHostNoteId);

        const panelDataAfterReinstall = await HomePanelQueries.loadHomePanelData(frontendApi);
        assert.equal(panelDataAfterReinstall.config.recentLimit, 3);
        assert.equal(panelDataAfterReinstall.pinned.length, 1);
    });

    it("installs code under root, never into the read-only _hidden root", async () => {
        const store = new SyntheticHeliumStore();
        const installed = await new HomePanelLifecycleManager(store, MODULE_DIR).install();
        const codeRoot = await store.getNote(installed.ownedCodeNoteIds[0]);
        assert.deepEqual(codeRoot.parentNoteIds, ["root"]);
        await assert.rejects(
            () => new HomePanelLifecycleManager(new SyntheticHeliumStore(), MODULE_DIR).install({ codeParentNoteId: "_hidden" }),
            /_hidden/
        );
    });

    it("refuses removal without deleting anything for foreign, descendant, clone, reference and active-entry graphs", async () => {
        for (const kind of ["foreign-label", "descendant", "clone", "reference", "active", "protected"]) {
            const store = new SyntheticHeliumStore();
            const manager = new HomePanelLifecycleManager(store, MODULE_DIR);
            const installed = await manager.install();
            const [rootId, jsxId, queriesId] = installed.ownedCodeNoteIds;
            if (kind === "foreign-label") {
                const foreign = await store.createNote({ parentNoteId: "root", title: "User note", type: "text" });
                await store.createAttribute({ noteId: foreign.noteId, type: "label", name: "heliumModuleId", value: "empyrean.home-panel" });
            }
            if (kind === "descendant") await store.createNote({ parentNoteId: rootId, title: "User note under code", type: "text" });
            if (kind === "clone") store.notes.get(queriesId).parentNoteIds.push("root");
            if (kind === "reference") await store.createAttribute({ noteId: "root", type: "relation", name: "template", value: jsxId });
            if (kind === "active") await manager.activate();
            if (kind === "protected") store.notes.get(queriesId).isProtected = true;
            await assert.rejects(() => manager.planUninstall(), /unexpected|disable/i, kind);
            await assert.rejects(() => manager.upgrade({ approvalHash: "x", maintenanceConfirmed: true }), /unexpected|disable/i, kind);
            assert.equal(store.deleted.length, 0, kind);
        }
    });

    it("stops when the graph changes after approval or between deletions", async () => {
        const store = new SyntheticHeliumStore();
        const manager = new HomePanelLifecycleManager(store, MODULE_DIR);
        const installed = await manager.install();
        const plan = await manager.planUninstall();
        store.notes.get(installed.entryJsxNoteId).blobId = "edited";
        await assert.rejects(() => manager.uninstall(plan.approvalHash, { maintenanceConfirmed: true }), /approval/i);
        assert.equal(store.deleted.length, 0);

        const fresh = await manager.planUninstall();
        const remove = store.deleteNote.bind(store);
        store.deleteNote = async (id) => {
            await remove(id);
            if (store.deleted.length === 1) store.notes.get(fresh.noteIds[1]).title = "concurrent edit";
        };
        await assert.rejects(() => manager.uninstall(fresh.approvalHash, { maintenanceConfirmed: true }), /changed/i);
        assert.equal(store.deleted.length, 1);
    });

    it("keeps host entry relations that target notes the module does not own", async () => {
        const store = new SyntheticHeliumStore();
        const manager = new HomePanelLifecycleManager(store, MODULE_DIR);
        const userRender = await store.createNote({ parentNoteId: "root", title: "My JSX", type: "code", mime: "text/jsx" });
        const installed = await manager.install();
        const foreign = await store.createAttribute({ noteId: installed.homeHostNoteId, type: "relation", name: "renderNote", value: userRender.noteId });
        for (const action of ["activate", "disable"]) {
            await assert.rejects(() => manager[action](), /unexpected/i, action);
        }
        assert.ok(store.attributes.has(foreign.attributeId), "user relation must survive");

        // A pre-existing host wired to user code is refused before any code is created.
        const other = new SyntheticHeliumStore();
        const host = await other.createNote({ parentNoteId: "root", title: "Home", type: "render", mime: "application/x-trilium-render" });
        await other.createAttribute({ noteId: host.noteId, type: "label", name: "heliumHomeHost", value: "empyrean.home-panel" });
        await other.createAttribute({ noteId: host.noteId, type: "relation", name: "renderNote", value: "root" });
        const before = other.notes.size;
        await assert.rejects(() => new HomePanelLifecycleManager(other, MODULE_DIR).install(), /unexpected/i);
        assert.equal(other.notes.size, before);
    });

    it("refuses duplicate retained config/host notes", async () => {
        const store = new SyntheticHeliumStore();
        for (let i = 0; i < 2; i++) {
            const n = await store.createNote({ parentNoteId: "root", title: "Home", type: "render", mime: "application/x-trilium-render" });
            await store.createAttribute({ noteId: n.noteId, type: "label", name: "heliumHomeHost", value: "empyrean.home-panel" });
        }
        await assert.rejects(() => new HomePanelLifecycleManager(store, MODULE_DIR).install(), /Expected one/);
    });

    it("excludes protected notes from Pinned, Inbox and Recent", async () => {
        const store = new SyntheticHeliumStore();
        const inbox = await store.createNote({ parentNoteId: "root", title: "Inbox", type: "book" });
        await store.createAttribute({ noteId: inbox.noteId, type: "label", name: "inbox", value: "" });
        await store.createNote({ parentNoteId: inbox.noteId, title: "Secret inbox item", type: "text", isProtected: true });
        const pinned = await store.createNote({ parentNoteId: "root", title: "Secret pinned", type: "text", isProtected: true });
        await store.createAttribute({ noteId: pinned.noteId, type: "label", name: "pinned", value: "" });
        const data = await HomePanelQueries.loadHomePanelData(store.createFrontendApi());
        const titles = [...data.pinned, ...data.inbox, ...data.recent].map((n) => n.title);
        assert.ok(titles.includes("Inbox"), "unprotected notes are still listed");
        assert.ok(!titles.some((t) => t.startsWith("Secret")), titles.join(", "));
    });

    it("accepts only HTTPS or loopback ETAPI endpoints and refuses redirects", async () => {
        assert.throws(() => new EtapiClientAdapter({ baseUrl: "http://notes.example.com", token: "t" }), /HTTPS or a loopback/);
        assert.throws(() => new EtapiClientAdapter({ baseUrl: "https://notes.example.com" }), /credential/);
        const calls = [];
        const adapter = new EtapiClientAdapter({
            baseUrl: "http://127.0.0.1:37810/",
            token: "t",
            fetchImpl: async (url, init) => {
                calls.push({ url, init });
                return { ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => ({}) };
            }
        });
        await adapter.getNote("root");
        assert.equal(calls[0].url, "http://127.0.0.1:37810/etapi/notes/root");
        assert.equal(calls[0].init.redirect, "error");
    });
});
