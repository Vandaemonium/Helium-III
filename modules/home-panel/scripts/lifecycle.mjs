#!/usr/bin/env node
/**
 * Lifecycle manager for Helium-III note-subtree module `empyrean.home-panel`.
 *
 * Implements the 5-stage lifecycle required by OpenSpec (`home-widget-module-v1`):
 *   1. install (inert): creates/imports the owned code subtree (`#heliumModuleId="empyrean.home-panel"`)
 *      and ensures the separated user config note (`#heliumModuleConfig="empyrean.home-panel"`)
 *      and Home host Render Note (`#heliumHomeHost="empyrean.home-panel"`) exist, with the
 *      entry relation kept inert (`~disabled:renderNote`) until explicit activation.
 *   2. activate: switches `~disabled:renderNote` -> `~renderNote` pointing to the installed
 *      `HomePanelRoot` JSX note (idempotent: never creates duplicate `~renderNote` relations).
 *   3. disable: switches `~renderNote` -> `~disabled:renderNote` on the Home host note,
 *      quiescing execution while retaining both code and user config/notes.
 *   4. uninstall (code-only): removes `~renderNote` / `~disabled:renderNote` pointing to the module's
 *      code note and deletes ONLY the owned executable code subtree (`#heliumModuleId="empyrean.home-panel"`).
 *      Never deletes the user's `Home Panel Config` note, `Home` host note, `#pinned` notes, or `#inbox` notes.
 *   5. upgrade / reinstall: replaces any older code subtree for `empyrean.home-panel`, preserves
 *      existing user config JSON verbatim, and reconnects `Home` without duplicate relations.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.resolve(__dirname, "..");

export function loadModuleSources(moduleDir = MODULE_DIR) {
    const manifest = JSON.parse(fs.readFileSync(path.join(moduleDir, "manifest.json"), "utf8"));
    const rootHtml = fs.readFileSync(path.join(moduleDir, "src/package_root.html"), "utf8");
    const rootJsx = fs.readFileSync(path.join(moduleDir, "src/HomePanelRoot.jsx"), "utf8");
    const queriesJs = fs.readFileSync(path.join(moduleDir, "src/HomePanelQueries.js"), "utf8");
    return { manifest, rootHtml, rootJsx, queriesJs };
}

/**
 * Adapter for talking to a live Helium-III / Trilium ETAPI endpoint.
 */
export class EtapiClientAdapter {
    constructor({ baseUrl, token, fetchImpl = globalThis.fetch }) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.token = token;
        this.fetchImpl = fetchImpl;
    }

    async request(method, route, body = undefined, contentType = "application/json") {
        const headers = { Authorization: this.token };
        let payload = body;
        if (body !== undefined && contentType === "application/json" && typeof body !== "string" && !Buffer.isBuffer(body)) {
            headers["Content-Type"] = "application/json";
            payload = JSON.stringify(body);
        } else if (body !== undefined) {
            headers["Content-Type"] = contentType;
        }
        const res = await this.fetchImpl(`${this.baseUrl}/etapi${route}`, {
            method,
            headers,
            body: payload
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`ETAPI ${method} ${route} failed (${res.status}): ${text}`);
        }
        if (res.status === 204) {
            return null;
        }
        const respType = res.headers.get("content-type") || "";
        if (respType.includes("application/json")) {
            return await res.json();
        }
        return await res.text();
    }

    async searchNotes(query) {
        const res = await this.request("GET", `/notes?search=${encodeURIComponent(query)}`);
        return res?.results || [];
    }

    async getNote(noteId) {
        return await this.request("GET", `/notes/${encodeURIComponent(noteId)}`);
    }

    async getNoteContent(noteId) {
        return await this.request("GET", `/notes/${encodeURIComponent(noteId)}/content`);
    }

    async createNote(params) {
        const res = await this.request("POST", "/create-note", params);
        return res.note;
    }

    async deleteNote(noteId) {
        await this.request("DELETE", `/notes/${encodeURIComponent(noteId)}`);
    }

    async createAttribute(attr) {
        return await this.request("POST", "/attributes", attr);
    }

    async deleteAttribute(attributeId) {
        await this.request("DELETE", `/attributes/${encodeURIComponent(attributeId)}`);
    }
}

export class HomePanelLifecycleManager {
    constructor(adapter, moduleDir = MODULE_DIR) {
        this.adapter = adapter;
        this.sources = loadModuleSources(moduleDir);
        this.moduleId = this.sources.manifest.moduleId;
        this.version = this.sources.manifest.version;
    }

    async findOwnedCodeNotes() {
        return await this.adapter.searchNotes(`#heliumModuleId="${this.moduleId}"`);
    }

    async findEntryJsxNote() {
        const notes = await this.findOwnedCodeNotes();
        return notes.find((n) =>
            (n.attributes || []).some((a) => a.type === "label" && a.name === "heliumModuleRole" && a.value === "entry-jsx")
        ) || null;
    }

    async findRetainedConfigNote() {
        const found = await this.adapter.searchNotes(`#heliumModuleConfig="${this.moduleId}"`);
        return found[0] || null;
    }

    async findHomeHostNote() {
        const found = await this.adapter.searchNotes(`#heliumHomeHost="${this.moduleId}"`);
        return found[0] || null;
    }

    /**
     * Step 1: Inert install (or upgrade if `replaceExisting: true`).
     * Creates owned code notes under `codeParentNoteId`, creates user config + Home host notes
     * under `userParentNoteId` ONLY if they do not already exist, and sets `~disabled:renderNote`
     * so imported code stays inert until `activate()` is called.
     */
    async install({
        codeParentNoteId = "_hidden",
        userParentNoteId = "root",
        replaceExisting = false
    } = {}) {
        const existingCode = await this.findOwnedCodeNotes();
        if (existingCode.length > 0) {
            if (!replaceExisting) {
                throw new Error(
                    `Module ${this.moduleId} is already installed (${existingCode.length} code notes found). Use upgrade() or pass replaceExisting: true.`
                );
            }
            await this.removeOwnedCodeNotesOnly();
        }

        // 1. Create owned code subtree
        const pkgRoot = await this.adapter.createNote({
            parentNoteId: codeParentNoteId,
            title: `${this.moduleId} (v${this.version})`,
            type: "book",
            mime: "text/html",
            content: this.sources.rootHtml
        });
        await this.adapter.createAttribute({
            noteId: pkgRoot.noteId,
            type: "label",
            name: "heliumModuleId",
            value: this.moduleId
        });
        await this.adapter.createAttribute({
            noteId: pkgRoot.noteId,
            type: "label",
            name: "heliumModuleVersion",
            value: this.version
        });
        await this.adapter.createAttribute({
            noteId: pkgRoot.noteId,
            type: "label",
            name: "heliumModuleRole",
            value: "code-root"
        });
        await this.adapter.createAttribute({
            noteId: pkgRoot.noteId,
            type: "label",
            name: "excludeFromExport",
            value: ""
        });

        const jsxRoot = await this.adapter.createNote({
            parentNoteId: pkgRoot.noteId,
            title: "HomePanelRoot",
            type: "code",
            mime: "text/jsx",
            content: this.sources.rootJsx
        });
        await this.adapter.createAttribute({
            noteId: jsxRoot.noteId,
            type: "label",
            name: "heliumModuleId",
            value: this.moduleId
        });
        await this.adapter.createAttribute({
            noteId: jsxRoot.noteId,
            type: "label",
            name: "heliumModuleVersion",
            value: this.version
        });
        await this.adapter.createAttribute({
            noteId: jsxRoot.noteId,
            type: "label",
            name: "heliumModuleRole",
            value: "entry-jsx"
        });

        const queriesNote = await this.adapter.createNote({
            parentNoteId: jsxRoot.noteId,
            title: "HomePanelQueries",
            type: "code",
            mime: "application/javascript;env=frontend",
            content: this.sources.queriesJs
        });
        await this.adapter.createAttribute({
            noteId: queriesNote.noteId,
            type: "label",
            name: "heliumModuleId",
            value: this.moduleId
        });
        await this.adapter.createAttribute({
            noteId: queriesNote.noteId,
            type: "label",
            name: "heliumModuleVersion",
            value: this.version
        });
        await this.adapter.createAttribute({
            noteId: queriesNote.noteId,
            type: "label",
            name: "heliumModuleRole",
            value: "submodule-js"
        });

        // 2. Ensure separated user config note exists (preserve existing user config if retained!)
        let configNote = await this.findRetainedConfigNote();
        let configPreserved = true;
        if (!configNote) {
            configPreserved = false;
            const defaultCfg = this.sources.manifest.retainedDataNotes.find((d) => d.key === "userConfigNote").defaultConfig;
            configNote = await this.adapter.createNote({
                parentNoteId: userParentNoteId,
                title: "Home Panel Config",
                type: "code",
                mime: "application/json",
                content: JSON.stringify(defaultCfg, null, 2)
            });
            await this.adapter.createAttribute({
                noteId: configNote.noteId,
                type: "label",
                name: "heliumModuleConfig",
                value: this.moduleId
            });
        }

        // 3. Ensure user Home host Render Note exists, wired inertly via `disabled:renderNote`
        let homeHost = await this.findHomeHostNote();
        if (!homeHost) {
            homeHost = await this.adapter.createNote({
                parentNoteId: userParentNoteId,
                title: "Home",
                type: "render",
                mime: "application/x-trilium-render",
                content: ""
            });
            await this.adapter.createAttribute({
                noteId: homeHost.noteId,
                type: "label",
                name: "heliumHomeHost",
                value: this.moduleId
            });
        }

        await this.setHostRenderRelation(homeHost.noteId, jsxRoot.noteId, { active: false });

        return {
            status: "installed-inert",
            moduleId: this.moduleId,
            version: this.version,
            ownedCodeNoteIds: [pkgRoot.noteId, jsxRoot.noteId, queriesNote.noteId],
            entryJsxNoteId: jsxRoot.noteId,
            configNoteId: configNote.noteId,
            configPreserved,
            homeHostNoteId: homeHost.noteId
        };
    }

    async setHostRenderRelation(homeHostNoteId, targetJsxNoteId, { active }) {
        const hostNote = await this.adapter.getNote(homeHostNoteId);
        const existingAttrs = hostNote.attributes || [];
        for (const attr of existingAttrs) {
            if (
                attr.type === "relation" &&
                (attr.name === "renderNote" || attr.name === "disabled:renderNote")
            ) {
                await this.adapter.deleteAttribute(attr.attributeId);
            }
        }
        await this.adapter.createAttribute({
            noteId: homeHostNoteId,
            type: "relation",
            name: active ? "renderNote" : "disabled:renderNote",
            value: targetJsxNoteId
        });
    }

    /**
     * Step 2: Activate the installed module entry point.
     */
    async activate() {
        const jsxRoot = await this.findEntryJsxNote();
        if (!jsxRoot) {
            throw new Error(`Cannot activate ${this.moduleId}: entry JSX code note not found.`);
        }
        const homeHost = await this.findHomeHostNote();
        if (!homeHost) {
            throw new Error(`Cannot activate ${this.moduleId}: Home host note not found.`);
        }
        await this.setHostRenderRelation(homeHost.noteId, jsxRoot.noteId, { active: true });
        return {
            status: "active",
            homeHostNoteId: homeHost.noteId,
            entryJsxNoteId: jsxRoot.noteId
        };
    }

    /**
     * Step 3: Disable the module (switches `~renderNote` -> `~disabled:renderNote`).
     */
    async disable() {
        const jsxRoot = await this.findEntryJsxNote();
        const homeHost = await this.findHomeHostNote();
        if (!homeHost) {
            return { status: "disabled", homeHostNoteId: null };
        }
        if (jsxRoot) {
            await this.setHostRenderRelation(homeHost.noteId, jsxRoot.noteId, { active: false });
        } else {
            const hostNote = await this.adapter.getNote(homeHost.noteId);
            for (const attr of hostNote.attributes || []) {
                if (attr.type === "relation" && attr.name === "renderNote") {
                    await this.adapter.deleteAttribute(attr.attributeId);
                }
            }
        }
        return {
            status: "disabled",
            homeHostNoteId: homeHost.noteId,
            entryJsxNoteId: jsxRoot?.noteId || null
        };
    }

    async removeOwnedCodeNotesOnly() {
        const ownedNotes = await this.findOwnedCodeNotes();
        const ownedIds = new Set(ownedNotes.map((n) => n.noteId));

        // Detach any renderNote or disabled:renderNote relations on the Home host pointing to owned code notes
        const homeHost = await this.findHomeHostNote();
        if (homeHost) {
            const freshHost = await this.adapter.getNote(homeHost.noteId);
            for (const attr of freshHost.attributes || []) {
                if (
                    attr.type === "relation" &&
                    (attr.name === "renderNote" || attr.name === "disabled:renderNote") &&
                    ownedIds.has(attr.value)
                ) {
                    await this.adapter.deleteAttribute(attr.attributeId);
                }
            }
        }

        // Delete children before parents (submodule-js -> entry-jsx -> code-root)
        const rolePriority = { "submodule-js": 1, "entry-jsx": 2, "code-root": 3 };
        const sorted = [...ownedNotes].sort((a, b) => {
            const roleA = (a.attributes || []).find((x) => x.name === "heliumModuleRole")?.value || "";
            const roleB = (b.attributes || []).find((x) => x.name === "heliumModuleRole")?.value || "";
            return (rolePriority[roleA] || 0) - (rolePriority[roleB] || 0);
        });

        const removedIds = [];
        for (const note of sorted) {
            await this.adapter.deleteNote(note.noteId);
            removedIds.push(note.noteId);
        }
        return removedIds;
    }

    /**
     * Step 4: Code-only uninstall.
     * Removes only module-owned code notes and active registrations while preserving user config,
     * the Home host note, `#pinned` notes, and `#inbox` notes.
     */
    async uninstall() {
        const removedCodeNoteIds = await this.removeOwnedCodeNotesOnly();
        const retainedConfig = await this.findRetainedConfigNote();
        const retainedHomeHost = await this.findHomeHostNote();

        return {
            status: "uninstalled-code-only",
            removedCodeNoteIds,
            retainedConfigNoteId: retainedConfig?.noteId || null,
            retainedHomeHostNoteId: retainedHomeHost?.noteId || null
        };
    }

    /**
     * Step 5: Upgrade / reinstall.
     * Replaces code subtree and reconnects to retained user config + Home host note.
     */
    async upgrade(opts = {}) {
        const homeHostBefore = await this.findHomeHostNote();
        let wasActive = false;
        if (homeHostBefore) {
            const fresh = await this.adapter.getNote(homeHostBefore.noteId);
            wasActive = (fresh.attributes || []).some(
                (a) => a.type === "relation" && a.name === "renderNote"
            );
        }

        const installRes = await this.install({ ...opts, replaceExisting: true });
        if (wasActive || opts.activateAfterUpgrade) {
            await this.activate();
            return { ...installRes, status: "upgraded-and-active" };
        }
        return { ...installRes, status: "upgraded-inert" };
    }
}

async function runCli() {
    const [action] = process.argv.slice(2);
    const baseUrl = process.env.HELIUM_URL || process.env.TRILIUM_URL || "http://127.0.0.1:8080";
    const token = process.env.HELIUM_ETAPI_TOKEN || process.env.TRILIUM_ETAPI_TOKEN;

    if (!action || !["install", "activate", "disable", "uninstall", "upgrade"].includes(action)) {
        console.log("Usage: HELIUM_URL=https://notes.empyrean.cc HELIUM_ETAPI_TOKEN=<token> node lifecycle.mjs <install|activate|disable|uninstall|upgrade>");
        process.exit(action ? 1 : 0);
    }
    if (!token) {
        console.error("Error: HELIUM_ETAPI_TOKEN (or TRILIUM_ETAPI_TOKEN) environment variable is required.");
        process.exit(1);
    }

    const adapter = new EtapiClientAdapter({ baseUrl, token });
    const manager = new HomePanelLifecycleManager(adapter);
    const result = await manager[action]();
    console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runCli().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
