import { becca, BBranch, type BNote, cls, getLog, getSql, markdownImportService, note_service as noteService } from "@triliumnext/core";
import { parseFrontmatter } from "@triliumnext/core/src/services/import/frontmatter.js";
import { t } from "i18next";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { escapeHtml } from "./utils.js";

export const AI_CONTEXT_NOTE_ID = "heliumAiContext";
export const MIRROR_LABEL = "heliumMirror";
const CHILD_PREFIX = `${AI_CONTEXT_NOTE_ID}_`;
const INDEX_FILE = "_index.md";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEBOUNCE_MS = 2000;
const FULL_CHECK_MS = 10 * 60 * 1000;
const OWNED_LABELS = [ MIRROR_LABEL, "readOnly", "disableVersioning" ];

export interface MirrorResult {
    created: string[];
    updated: string[];
    deleted: string[];
}

/**
 * Starts mirroring the Markdown files in `HELIUM_AI_CONTEXT_DIR` into the read-only "AI-Context"
 * note: once now, again shortly after a change in the folder, and every ten minutes, because a bind
 * mount can miss file events. Does nothing when the variable is unset.
 */
export function startAiContextMirror(dir = process.env.HELIUM_AI_CONTEXT_DIR) {
    if (!dir) return;
    const run = () => {
        try {
            const result = cls.init(() => syncAiContext(dir));
            if (result && (result.created.length || result.updated.length || result.deleted.length)) {
                getLog().info(`AI-Context mirror: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted.`);
            }
        } catch (e) {
            getLog().error(`AI-Context mirror failed: ${e instanceof Error ? e.message : e}`);
        }
    };
    run();

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        fs.watch(dir, () => {
            clearTimeout(timer);
            timer = setTimeout(run, DEBOUNCE_MS);
        }).on("error", () => { /* The periodic check covers a watcher that dies. */ });
    } catch {
        getLog().info(`AI-Context mirror: cannot watch ${dir}; relying on the periodic check.`);
    }
    setInterval(run, FULL_CHECK_MS).unref();
}

/**
 * Brings the mirror in line with `dir`. Touches only notes it owns: the parent with the fixed ID and
 * children whose ID starts with `heliumAiContext_`, each carrying `#heliumMirror`. Returns `null`
 * when the folder is unreadable or empty, or when a foreign note holds the parent ID; nothing changes then.
 */
export function syncAiContext(dir: string): MirrorResult | null {
    const files = readMarkdownFiles(dir);
    if (!files || !files.size) {
        getLog().info(`AI-Context mirror: ${dir} is unreadable or has no Markdown files; nothing changed.`);
        return null;
    }
    const existingParent = becca.notes[AI_CONTEXT_NOTE_ID];
    if (existingParent && !existingParent.hasOwnedLabel(MIRROR_LABEL)) {
        getLog().info(`AI-Context mirror: note ${AI_CONTEXT_NOTE_ID} is not a mirror note; nothing changed.`);
        return null;
    }

    return getSql().transactional(() => {
        const result: MirrorResult = { created: [], updated: [], deleted: [] };
        const parent = existingParent ?? createOwnedNote(AI_CONTEXT_NOTE_ID, "root", t("hidden-subtree.helium-ai-context-title"), "", [
            { type: "label", name: "iconClass", value: "bx bx-brain" }
        ]);
        if (!existingParent) result.created.push(AI_CONTEXT_NOTE_ID);

        const order = fileOrder(files);
        const wanted = new Set<string>();
        for (const [ name, source ] of files) {
            const noteId = childNoteId(name);
            wanted.add(noteId);
            const position = (order.indexOf(name) + 1) * 10;
            if (source === null) continue; // Unreadable or too large: the existing note stays as it is.

            const { body } = parseFrontmatter(source);
            const title = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body)?.[1] ?? name.replace(/\.md$/i, "");
            const html = markdownImportService.renderToHtml(body, title);
            const note = becca.notes[noteId];
            if (!note) {
                createOwnedNote(noteId, AI_CONTEXT_NOTE_ID, title, html, [ { type: "label", name: "originalFileName", value: name } ], position);
                result.created.push(noteId);
                continue;
            }
            if (!isOwned(note)) continue;
            if (note.title !== title || note.getContent() !== html) {
                note.title = title;
                note.save();
                note.setContent(html);
                result.updated.push(noteId);
            }
            const branch = becca.getBranchFromChildAndParent(noteId, AI_CONTEXT_NOTE_ID);
            if (branch && branch.notePosition !== position) {
                branch.notePosition = position;
                branch.save();
            } else if (!branch) {
                new BBranch({ noteId, parentNoteId: AI_CONTEXT_NOTE_ID, notePosition: position }).save();
            }
        }

        for (const attr of becca.findAttributes("label", MIRROR_LABEL)) {
            const note = attr.getNote();
            if (note.noteId.startsWith(CHILD_PREFIX) && !wanted.has(note.noteId)) {
                note.deleteNote();
                result.deleted.push(note.noteId);
            }
        }

        if (result.created.length || result.updated.length || result.deleted.length) {
            const time = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
            parent.setContent(`<p>${escapeHtml(t("hidden-subtree.helium-ai-context-description", { time }))}</p>`);
        }
        return result;
    });
}

/** The child note ID of a file: the same on every instance, so mirrors that sync converge. */
export function childNoteId(fileName: string) {
    return CHILD_PREFIX + crypto.createHash("sha256").update(fileName).digest("hex").slice(0, 16);
}

/**
 * The `*.md` regular files directly in `dir`, mapped to their text, or to `null` when one cannot be
 * read or exceeds 2 MB. Symbolic links and subfolders are skipped. Returns `null` when `dir` is unreadable.
 */
function readMarkdownFiles(dir: string): Map<string, string | null> | null {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    const files = new Map<string, string | null>();
    for (const entry of entries) {
        if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
        const filePath = path.join(dir, entry.name);
        try {
            const stat = fs.lstatSync(filePath);
            files.set(entry.name, stat.isFile() && stat.size <= MAX_FILE_BYTES ? fs.readFileSync(filePath, "utf8") : null);
        } catch {
            files.set(entry.name, null);
        }
    }
    return files;
}

/** `_index.md` first, then the files in the order `_index.md` names them in backticks, then the rest alphabetically. */
function fileOrder(files: Map<string, string | null>) {
    const index = files.get(INDEX_FILE) ?? "";
    const named = [ ...index.matchAll(/`([^`/]+\.md)`/g) ].map((m) => m[1]);
    const ordered = [ INDEX_FILE, ...named, ...[ ...files.keys() ].sort() ];
    return [ ...new Set(ordered) ].filter((name) => files.has(name));
}

function isOwned(note: BNote) {
    return note.hasOwnedLabel(MIRROR_LABEL);
}

function createOwnedNote(noteId: string, parentNoteId: string, title: string, content: string,
    extra: { type: "label"; name: string; value: string }[], notePosition?: number) {
    return noteService.createNewNote({
        noteId,
        parentNoteId,
        title,
        content,
        type: "text",
        mime: "text/html",
        isProtected: false,
        notePosition,
        attributes: [ ...OWNED_LABELS.map((name) => ({ type: "label" as const, name, value: "" })), ...extra ]
    }).note;
}
