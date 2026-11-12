#!/usr/bin/env node
/**
 * Lifecycle manager for Helium-III note-subtree module `empyrean.home-panel`.
 *
 * Implements the 5-stage lifecycle required by OpenSpec (`home-widget-module-v1`):
 *   1. install (inert): creates the owned code subtree (`#heliumModuleId="empyrean.home-panel"`)
 *      under `root` and ensures the separated user config note (`#heliumModuleConfig`) and Home
 *      host Render Note (`#heliumHomeHost`) exist, with the entry relation kept inert
 *      (`~disabled:renderNote`) until explicit activation.
 *   2. activate / 3. disable: switch the host relation between `~renderNote` and
 *      `~disabled:renderNote`. Only relations that target Home-owned code are touched.
 *   4. uninstall (code-only, guarded): the same protocol as `empyrean.quick-notes` — exact owned
 *      inventory, single parents, no unexpected descendants or external references, a plan preview
 *      with a SHA-256 approval hash, `--maintenance-confirmed`, children-first deletion with a
 *      per-note recheck right before each delete. Server-side cascade is never relied on.
 *   5. upgrade / reinstall: runs the guarded uninstall (same approval) and then install, keeping the
 *      user config JSON verbatim and the Home host note.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.resolve(__dirname, "..");

const own = (note, name) => (note.attributes || []).filter((a) => a.noteId === note.noteId && a.type === "label" && a.name === name);
const label = (note, name) => own(note, name)[0]?.value;
const relations = (note) => (note.attributes || []).filter((a) => a.noteId === note.noteId && a.type === "relation");
const ENTRY_RELATIONS = ["renderNote", "disabled:renderNote"];

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
        const url = new URL(baseUrl);
        if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) {
            throw new Error("Use HTTPS or a loopback-only test endpoint.");
        }
        if (!token) throw new Error("ETAPI credential is required in the process environment.");
        this.baseUrl = url.href.replace(/\/+$/, "");
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
        const res = await this.fetchImpl(`${this.baseUrl}/etapi${route}`, { method, headers, body: payload, redirect: "error" });
        if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            const code = /^[A-Z_]+$/.test(detail.code || "") ? detail.code : "UNSPECIFIED";
            throw new Error(`ETAPI ${method} failed (${res.status}, ${code}); no automatic retry was issued.`);
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

    async allNotes() {
        // No note content is read. Complete graph traversal avoids search limits and hidden/archived omissions.
        const todo = ["root", "_hidden"], seen = new Set(), notes = [];
        while (todo.length) {
            const id = todo.pop();
            if (seen.has(id)) continue;
            seen.add(id);
            const note = await this.getNote(id);
            notes.push(note);
            todo.push(...note.childNoteIds);
        }
        return notes;
    }
}

export class HomePanelLifecycleManager {
    constructor(adapter, moduleDir = MODULE_DIR) {
        this.adapter = adapter;
        this.sources = loadModuleSources(moduleDir);
        this.moduleId = this.sources.manifest.moduleId;
        this.version = this.sources.manifest.version;
        this.codeRoles = this.sources.manifest.ownedCodeNotes.map((n) => n.labels.find((l) => l.name === "heliumModuleRole").value);
    }

    codeRole(note) {
        return label(note, "heliumModuleId") === this.moduleId ? label(note, "heliumModuleRole") ?? "" : null;
    }

    isConfig(note) { return label(note, "heliumModuleConfig") === this.moduleId; }

    isHost(note) { return label(note, "heliumHomeHost") === this.moduleId; }

    async inventory() { return this.adapter.allNotes(); }

    unique(notes, predicate, description, optional = false) {
        const found = notes.filter(predicate);
        if (found.length === 0 && optional) return null;
        if (found.length !== 1) throw new Error(`Expected one ${description}; found ${found.length}. Resolve duplicates/partial installs manually.`);
        return found[0];
    }

    async findOwnedCodeNotes() {
        return (await this.inventory()).filter((n) => this.codeRole(n) !== null);
    }

    /**
     * Step 1: Inert install. With `replaceExisting: true` an existing code subtree is first removed
     * through the guarded `uninstall()`, so the same `approvalHash` and `maintenanceConfirmed` apply.
     */
    async install({
        codeParentNoteId = "root",
        userParentNoteId = "root",
        replaceExisting = false,
        approvalHash,
        maintenanceConfirmed = false
    } = {}) {
        let all = await this.inventory();
        if (all.some((n) => this.codeRole(n) !== null)) {
            if (!replaceExisting) {
                throw new Error(`Module ${this.moduleId} is already installed. Use preview-uninstall, then upgrade with the approved plan hash.`);
            }
            await this.uninstall(approvalHash, { maintenanceConfirmed });
            all = await this.inventory();
        }
        if (all.some((n) => n.noteId === userParentNoteId && n.isProtected)) throw new Error("Retained parent must be unprotected.");
        let configNote = this.unique(all, (n) => this.isConfig(n), "Home Panel config note", true);
        let homeHost = this.unique(all, (n) => this.isHost(n), "Home host note", true);
        if (configNote && (configNote.type !== "code" || configNote.isProtected)) throw new Error("Retained config note has incompatible type/protection.");
        if (homeHost && (homeHost.type !== "render" || homeHost.isProtected)) throw new Error("Retained Home host note has incompatible type/protection.");
        // No code exists at this point, so any entry relation on the host belongs to someone else.
        if (homeHost && relations(homeHost).some((a) => ENTRY_RELATIONS.includes(a.name))) {
            throw new Error("Unexpected host entry reference; refusing to alter it.");
        }

        const createOwned = async (parentNoteId, title, type, mime, content, role) => {
            const note = await this.adapter.createNote({ parentNoteId, title, type, mime, content });
            for (const [name, value] of [["heliumModuleId", this.moduleId], ["heliumModuleVersion", this.version], ["heliumModuleRole", role]]) {
                await this.adapter.createAttribute({ noteId: note.noteId, type: "label", name, value });
            }
            return note;
        };
        const pkgRoot = await createOwned(codeParentNoteId, `${this.moduleId} (v${this.version})`, "book", "text/html", this.sources.rootHtml, "code-root");
        await this.adapter.createAttribute({ noteId: pkgRoot.noteId, type: "label", name: "excludeFromExport", value: "" });
        const jsxRoot = await createOwned(pkgRoot.noteId, "HomePanelRoot", "code", "text/jsx", this.sources.rootJsx, "entry-jsx");
        const queriesNote = await createOwned(jsxRoot.noteId, "HomePanelQueries", "code", "application/javascript;env=frontend", this.sources.queriesJs, "submodule-js");

        // Ensure separated user config note exists (preserve existing user config if retained!)
        const configPreserved = Boolean(configNote);
        if (!configNote) {
            const defaultCfg = this.sources.manifest.retainedDataNotes.find((d) => d.key === "userConfigNote").defaultConfig;
            configNote = await this.adapter.createNote({
                parentNoteId: userParentNoteId,
                title: "Home Panel Config",
                type: "code",
                mime: "application/json",
                content: JSON.stringify(defaultCfg, null, 2)
            });
            await this.adapter.createAttribute({ noteId: configNote.noteId, type: "label", name: "heliumModuleConfig", value: this.moduleId });
        }

        if (!homeHost) {
            homeHost = await this.adapter.createNote({
                parentNoteId: userParentNoteId,
                title: "Home",
                type: "render",
                mime: "application/x-trilium-render",
                content: ""
            });
            await this.adapter.createAttribute({ noteId: homeHost.noteId, type: "label", name: "heliumHomeHost", value: this.moduleId });
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

    /** Switches the host entry relation; refuses any entry relation that targets non-owned code. */
    async setHostRenderRelation(homeHostNoteId, targetJsxNoteId, { active }) {
        const all = await this.inventory();
        const ownedIds = new Set(all.filter((n) => this.codeRole(n) !== null).map((n) => n.noteId));
        const host = all.find((n) => n.noteId === homeHostNoteId);
        if (!host) throw new Error("Home host note not found.");
        const wanted = active ? "renderNote" : "disabled:renderNote";
        const entries = relations(host).filter((a) => ENTRY_RELATIONS.includes(a.name));
        if (entries.some((a) => !ownedIds.has(a.value))) throw new Error("Unexpected host entry reference; refusing to alter it.");
        let kept = false;
        for (const a of entries) {
            if (!kept && a.name === wanted && a.value === targetJsxNoteId) { kept = true; continue; }
            await this.adapter.deleteAttribute(a.attributeId);
        }
        if (!kept) await this.adapter.createAttribute({ noteId: homeHostNoteId, type: "relation", name: wanted, value: targetJsxNoteId });
    }

    async findEntryAndHost() {
        const all = await this.inventory();
        return {
            jsxRoot: this.unique(all, (n) => this.codeRole(n) === "entry-jsx", "entry JSX code note", true),
            homeHost: this.unique(all, (n) => this.isHost(n), "Home host note", true)
        };
    }

    /**
     * Step 2: Activate the installed module entry point.
     */
    async activate() {
        await this.planUninstall({ forActivation: true });
        const { jsxRoot, homeHost } = await this.findEntryAndHost();
        if (!jsxRoot) throw new Error(`Cannot activate ${this.moduleId}: entry JSX code note not found.`);
        if (!homeHost) throw new Error(`Cannot activate ${this.moduleId}: Home host note not found.`);
        await this.setHostRenderRelation(homeHost.noteId, jsxRoot.noteId, { active: true });
        return { status: "active", homeHostNoteId: homeHost.noteId, entryJsxNoteId: jsxRoot.noteId, reloadRequired: true };
    }

    /**
     * Step 3: Disable the module (switches `~renderNote` -> `~disabled:renderNote`).
     */
    async disable() {
        const { jsxRoot, homeHost } = await this.findEntryAndHost();
        if (homeHost && jsxRoot) await this.setHostRenderRelation(homeHost.noteId, jsxRoot.noteId, { active: false });
        return { status: "disabled", homeHostNoteId: homeHost?.noteId || null, entryJsxNoteId: jsxRoot?.noteId || null, reloadRequired: true };
    }

    /** Validates the owned code graph and returns a removal plan with its approval hash. Deletes nothing. */
    async planUninstall({ forActivation = false } = {}) {
        const all = await this.inventory();
        const owned = all.filter((n) => this.codeRole(n) !== null);
        if (owned.length !== this.codeRoles.length) throw new Error("Unexpected or incomplete owned code inventory.");
        const byId = new Map(owned.map((n) => [n.noteId, n]));
        for (const role of this.codeRoles) this.unique(owned, (n) => this.codeRole(n) === role, `${role} code`);
        const root = owned.find((n) => this.codeRole(n) === "code-root");
        const host = this.unique(all, (n) => this.isHost(n), "Home host note", true);
        for (const n of owned) {
            if (n.isProtected || n.parentNoteIds.length !== 1 || (n !== root && !byId.has(n.parentNoteIds[0]))) throw new Error("Unexpected shared/cloned/protected code asset.");
            if (n.childNoteIds.some((id) => !byId.has(id))) throw new Error("Unexpected user descendant under code; nothing can be removed.");
            if (this.isConfig(n) || this.isHost(n)) throw new Error("Unexpected retained data inside code.");
        }
        const visited = new Set(), order = [];
        const walk = (id) => {
            if (visited.has(id)) throw new Error("Unexpected cyclic/shared code graph.");
            visited.add(id);
            for (const child of byId.get(id).childNoteIds) walk(child);
            order.push(id);
        };
        walk(root.noteId);
        if (visited.size !== owned.length) throw new Error("Unexpected disconnected code assets.");
        const allowed = [];
        for (const n of all) {
            for (const a of relations(n).filter((a) => byId.has(a.value))) {
                const toEntry = host && n.noteId === host.noteId && this.codeRole(byId.get(a.value)) === "entry-jsx";
                if (a.name === "renderNote") {
                    if (forActivation && toEntry) continue;
                    throw new Error("Disable and reload Home before planning removal.");
                }
                if (toEntry && a.name === "disabled:renderNote") allowed.push(a.attributeId);
                else throw new Error("Unexpected external reference to module code; nothing can be removed.");
            }
        }
        const snapshot = owned
            .map((n) => ({ id: n.noteId, blob: n.blobId, title: n.title, type: n.type, mime: n.mime, parents: n.parentNoteIds, children: n.childNoteIds, attributes: n.attributes }))
            .sort((a, b) => a.id.localeCompare(b.id));
        const approvalHash = createHash("sha256").update(JSON.stringify({ snapshot, hostId: host?.noteId ?? null, allowed })).digest("hex");
        const plan = {
            moduleId: this.moduleId,
            noteIds: order,
            hostNoteId: host?.noteId ?? null,
            relationIds: allowed,
            approvalHash,
            retained: "All user notes, the Home Panel Config note and the Home host note are retained."
        };
        Object.defineProperty(plan, "expected", { value: new Map(owned.map((note) => [note.noteId, note])) });
        return plan;
    }

    /**
     * Step 4: Guarded code-only uninstall. Requires the hash from `planUninstall()` and an explicit
     * maintenance confirmation.
     */
    async uninstall(approvalHash, { maintenanceConfirmed = false } = {}) {
        const plan = await this.planUninstall();
        if (!approvalHash || approvalHash !== plan.approvalHash) throw new Error("Explicit approval of the current removal plan is required.");
        if (!maintenanceConfirmed) throw new Error("Exclusive maintenance confirmation is required; stop editing/sync peers first. ETAPI has no atomic graph lock.");
        for (const id of plan.relationIds) await this.adapter.deleteAttribute(id);
        // Recheck each leaf before deletion; this is not an atomic server-side graph lock.
        // The operator must keep editing/sync peers quiescent during this maintenance operation.
        for (const id of plan.noteIds) {
            const all = await this.inventory(), note = all.find((n) => n.noteId === id);
            const expected = plan.expected.get(id);
            if (!note || this.codeRole(note) === null || note.childNoteIds.length || note.parentNoteIds.length !== 1) throw new Error("Unexpected graph change; removal stopped.");
            for (const key of ["blobId", "title", "type", "mime", "parentNoteIds", "attributes"]) {
                if (JSON.stringify(note[key]) !== JSON.stringify(expected[key])) throw new Error("Code asset changed after approval; removal stopped.");
            }
            if (all.some((n) => relations(n).some((a) => a.value === id))) throw new Error("New reference detected; removal stopped.");
            await this.adapter.deleteNote(id);
        }
        return {
            status: "uninstalled-code-only",
            removedCodeNoteIds: plan.noteIds,
            retainedHomeHostNoteId: plan.hostNoteId,
            retained: plan.retained
        };
    }

    /**
     * Step 5: Upgrade / reinstall. An installed code subtree is removed only through the guarded
     * uninstall, so `approvalHash` and `maintenanceConfirmed` are required when code exists.
     */
    async upgrade(opts = {}) {
        const installRes = await this.install({ ...opts, replaceExisting: true });
        if (opts.activateAfterUpgrade) {
            await this.activate();
            return { ...installRes, status: "upgraded-and-active" };
        }
        return { ...installRes, status: "upgraded-inert" };
    }
}

async function runCli() {
    const [action, approvalHash] = process.argv.slice(2);
    const actions = ["install", "activate", "disable", "preview-uninstall", "uninstall", "upgrade"];
    if (!actions.includes(action)) {
        throw new Error("Commands: install | activate | disable | preview-uninstall | uninstall <approved-plan-sha256> --maintenance-confirmed | upgrade <approved-plan-sha256> --maintenance-confirmed.");
    }
    const baseUrl = process.env.HELIUM_URL || process.env.TRILIUM_URL || "http://127.0.0.1:8080";
    const token = process.env.HELIUM_ETAPI_TOKEN || process.env.TRILIUM_ETAPI_TOKEN;
    const manager = new HomePanelLifecycleManager(new EtapiClientAdapter({ baseUrl, token }));
    const maintenanceConfirmed = process.argv.includes("--maintenance-confirmed");
    const result = action === "preview-uninstall" ? await manager.planUninstall()
        : action === "uninstall" ? await manager.uninstall(approvalHash, { maintenanceConfirmed })
        : action === "upgrade" ? await manager.upgrade({ approvalHash, maintenanceConfirmed })
        : await manager[action]();
    console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runCli().catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
