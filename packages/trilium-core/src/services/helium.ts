import {
    type ChecklistData, DEFAULT_HOME_CONFIG, HELIUM_HOME_CONFIG_NOTE_ID, HELIUM_QUICK_CONFIG_NOTE_ID, HELIUM_QUICK_NOTES_FOLDER_ID,
    type HeliumHomeConfig, type HeliumQuickConfig, type HomeBoard, type HomeData, type HomeItem, normalizeBoard, normalizeHomeConfig,
    QUICK_ARCHIVED_LABEL, QUICK_PINNED_LABEL, type QuickNoteCard, type QuickNotesData, textCapture
} from "@triliumnext/commons";
import { t } from "i18next";
import { parse } from "node-html-parser";

import becca from "../becca/becca.js";
import type BNote from "../becca/entities/bnote.js";
import { ValidationError } from "../errors.js";
import noteService from "./notes.js";
import { escapeHtml, stripTags, unescapeHtml } from "./utils/index.js";

/** Labels that mark notes of the retired Home and Quick Notes modules, which Home leaves out. */
const LEGACY_MODULE_LABELS = [ "heliumModuleId", "heliumModuleConfig", "heliumHomeHost", "heliumQuickRetained" ];

/**
 * Seeds the Helium configuration notes that are still empty, and creates the Quick Notes folder
 * together with its configuration. Runs inside the hidden subtree check, after the config notes
 * exist. A note that already holds configuration is never rewritten.
 */
export function seedHeliumConfig() {
    const homeConfig = becca.notes[HELIUM_HOME_CONFIG_NOTE_ID];
    if (homeConfig && isEmptyContent(homeConfig)) {
        homeConfig.setContent(JSON.stringify(DEFAULT_HOME_CONFIG, null, 4));
    }

    const quickConfig = becca.notes[HELIUM_QUICK_CONFIG_NOTE_ID];
    if (quickConfig && isEmptyContent(quickConfig)) {
        writeQuickConfig(quickConfig);
    }
}

export function getHomeConfig(): HeliumHomeConfig {
    return normalizeHomeConfig(readJson(HELIUM_HOME_CONFIG_NOTE_ID));
}

/** Replaces the board in the Home configuration, keeping the other settings. */
export function saveHomeBoard(raw: unknown): HomeBoard {
    const board = normalizeBoard(raw);
    if (!board) {
        throw new ValidationError("Invalid Home layout.");
    }
    const note = becca.notes[HELIUM_HOME_CONFIG_NOTE_ID];
    if (!note || note.isProtected || !note.isContentAvailable()) {
        throw new ValidationError("The Home configuration note is unavailable.");
    }
    note.setContent(JSON.stringify({ ...getHomeConfig(), board }, null, 4));
    return board;
}

/** The to-do items of a text note, in document order. Protected notes are refused even while unlocked. */
export function getChecklist(noteId: string): ChecklistData {
    const note = becca.notes[noteId];
    if (!note || note.isDeleted || note.isInHiddenSubtree()) {
        return { status: "missing", title: "", items: [] };
    }
    if (note.isProtected) {
        return { status: "protected", title: "", items: [] };
    }
    if (note.type !== "text") {
        return { status: "unsupported", title: note.title, items: [] };
    }
    const items = findTodoInputs(String(note.getContent())).map(({ text, checked }, index) => ({ index, text, checked }));
    return { status: "ok", title: note.title, items };
}

/**
 * Ticks or unticks one to-do item. The content is read again inside this transaction, and the item
 * must still carry `expectedText`, so an edit made elsewhere since the client loaded the list is
 * never overwritten or applied to the wrong item. Only the checkbox tag is changed.
 */
export function setChecklistItem(noteId: string, index: unknown, checked: unknown, expectedText: unknown) {
    if (typeof checked !== "boolean" || typeof expectedText !== "string" || !Number.isInteger(index)) {
        throw new ValidationError("Invalid checklist change.");
    }
    const note = becca.notes[noteId];
    if (!note || note.isDeleted || note.isProtected || note.type !== "text" || note.isInHiddenSubtree()) {
        throw new ValidationError("Not an unprotected text note.");
    }
    const content = String(note.getContent());
    const item = findTodoInputs(content)[index as number];
    if (!item || item.text !== expectedText) {
        throw new ValidationError("The checklist changed since it was loaded. Reload it and try again.");
    }
    if (item.checked === checked) return;
    const [ start, end ] = item.range;
    const tag = content.slice(start, end);
    const newTag = checked
        ? tag.replace(/^<input/i, "<input checked=\"checked\"")
        : tag.replace(/\s+checked(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?(?=[\s/>])/i, "");
    note.setContent(content.slice(0, start) + newTag + content.slice(end));
}

/** Creates the visible "Checklist" note under root with one empty to-do item. */
export function createChecklistNote() {
    const { note } = noteService.createNewNote({
        parentNoteId: "root",
        title: t("hidden-subtree.helium-checklist-title"),
        content: `<ul class="todo-list"><li><label class="todo-list__label"><input type="checkbox" disabled="disabled"><span class="todo-list__label__description">${escapeHtml(t("hidden-subtree.helium-checklist-first-item"))}</span></label></li></ul>`,
        type: "text",
        mime: "text/html",
        isProtected: false
    });
    return { noteId: note.noteId };
}

function findTodoInputs(html: string) {
    return parse(html).querySelectorAll("ul.todo-list li input[type=checkbox]").map((input) => {
        const label = input.closest("label") ?? input.parentNode;
        return { text: label?.text.trim() ?? "", checked: input.hasAttribute("checked"), range: input.range };
    });
}

export function getHomeData(): HomeData {
    const config = getHomeConfig();
    const isEligible = (note: BNote | null | undefined): note is BNote => !!note && isHomeEligible(note, config);

    const recent = Object.values(becca.notes).filter(isEligible);

    const pinned = notesWithLabel(config.pinnedLabel).filter(isEligible);

    const inbox = new Map<string, BNote>();
    for (const labeled of notesWithLabel(config.inboxLabel)) {
        for (const candidate of [ ...labeled.getChildNotes(), labeled ]) {
            if (isEligible(candidate)) inbox.set(candidate.noteId, candidate);
        }
    }

    return {
        recent: newestFirst(recent).slice(0, config.recentLimit).map(toHomeItem),
        pinned: newestFirst(pinned).slice(0, config.pinnedLimit).map(toHomeItem),
        inbox: newestFirst([ ...inbox.values() ]).slice(0, config.inboxLimit).map(toHomeItem)
    };
}

export function getQuickNotes(): QuickNotesData {
    const { status, folder } = resolveQuickNotesFolder();
    if (!folder) {
        return { status, folderNoteId: null, cards: [] };
    }
    const cards = folder.getChildNotes()
        .filter(isQuickNoteCard)
        .map((note): QuickNoteCard => ({
            noteId: note.noteId,
            title: note.title,
            text: htmlToText(String(note.getContent())),
            utcDateModified: note.utcDateModified ?? "",
            pinned: note.getOwnedLabelValue(QUICK_PINNED_LABEL) === "true",
            archived: note.getOwnedLabelValue(QUICK_ARCHIVED_LABEL) === "true"
        }));
    return { status, folderNoteId: folder.noteId, cards };
}

/** Creates one unprotected text note from composer text in the configured folder. */
export function createQuickNote(text: unknown) {
    const capture = typeof text === "string" ? textCapture(text) : null;
    if (!capture) {
        throw new ValidationError("Enter some text before saving.");
    }
    const folder = requireQuickNotesFolder();
    return noteService.createNewNote({
        parentNoteId: folder.noteId,
        title: capture.title,
        content: capture.content,
        type: "text",
        mime: "text/html",
        isProtected: false
    });
}

/** Sets a card's own pinned or archived label to `true` or `false`. */
export function setQuickNoteState(noteId: string, key: unknown, value: unknown) {
    const name = key === "pinned" ? QUICK_PINNED_LABEL : key === "archived" ? QUICK_ARCHIVED_LABEL : null;
    if (!name || typeof value !== "boolean") {
        throw new ValidationError("Unknown Quick Notes state.");
    }
    const folder = requireQuickNotesFolder();
    const note = folder.getChildNotes().find((child) => child.noteId === noteId);
    if (!note || !isQuickNoteCard(note)) {
        throw new ValidationError("Not an unprotected Quick Notes card.");
    }
    note.setLabel(name, value ? "true" : "false");
}

/** Runs setup again, e.g. after the user renamed a conflicting folder. */
export function retryQuickNotesSetup() {
    seedHeliumConfig();
    // Unreadable or unsupported config is derived data, so retrying replaces it instead of failing silently.
    const quickConfig = becca.notes[HELIUM_QUICK_CONFIG_NOTE_ID];
    if (quickConfig?.isContentAvailable() && !configuredDataNoteId()) {
        writeQuickConfig(quickConfig);
    }
    return getQuickNotes();
}

function writeQuickConfig(quickConfig: BNote) {
    const folder = ensureQuickNotesFolder();
    if (folder) {
        const config: HeliumQuickConfig = { schemaVersion: 1, dataNoteId: folder.noteId };
        quickConfig.setContent(JSON.stringify(config, null, 4));
    }
}

function configuredDataNoteId() {
    const config = readJson(HELIUM_QUICK_CONFIG_NOTE_ID) as Partial<HeliumQuickConfig> | null;
    return config?.schemaVersion === 1 && typeof config.dataNoteId === "string" ? config.dataNoteId : null;
}

function ensureQuickNotesFolder(): BNote | null {
    const existing = becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID];
    if (existing) {
        // Created by this setup on another peer and synced here.
        return existing;
    }
    const title = t("hidden-subtree.helium-quick-notes-folder");
    const root = becca.getNoteOrThrow("root");
    if (root.getChildNotes().some((child) => child.title === title)) {
        return null;
    }
    return noteService.createNewNote({
        noteId: HELIUM_QUICK_NOTES_FOLDER_ID,
        parentNoteId: "root",
        title,
        content: "",
        type: "text",
        isProtected: false
    }).note;
}

function resolveQuickNotesFolder(): { status: QuickNotesData["status"]; folder: BNote | null } {
    const dataNoteId = configuredDataNoteId();
    if (!dataNoteId) {
        return { status: hasFolderConflict() ? "conflict" : "unconfigured", folder: null };
    }
    const folder = becca.notes[dataNoteId];
    if (!folder || folder.isInHiddenSubtree()) {
        return { status: "missing", folder: null };
    }
    if (folder.isProtected) {
        return { status: "protected", folder: null };
    }
    return { status: "ok", folder };
}

function requireQuickNotesFolder() {
    const { status, folder } = resolveQuickNotesFolder();
    if (!folder) {
        throw new ValidationError(`Quick Notes folder unavailable (${status}); nothing was saved.`);
    }
    return folder;
}

function hasFolderConflict() {
    const title = t("hidden-subtree.helium-quick-notes-folder");
    return !becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID]
        && becca.getNoteOrThrow("root").getChildNotes().some((child) => child.title === title);
}

function isQuickNoteCard(note: BNote) {
    return note.type === "text" && !note.isProtected;
}

function isHomeEligible(note: BNote, config: HeliumHomeConfig) {
    // Protected notes are left out even while a protected session is open.
    return !note.noteId.startsWith("_")
        && note.noteId !== "root"
        && !note.isProtected
        && !(config.excludeHidden && note.isInHiddenSubtree())
        && !(config.excludeArchived && note.isArchived)
        && !LEGACY_MODULE_LABELS.some((label) => note.hasOwnedLabel(label));
}

function notesWithLabel(name: string) {
    return becca.findAttributes("label", name).map((attr) => attr.getNote());
}

function newestFirst(notes: BNote[]) {
    return [ ...new Set(notes) ].sort((a, b) => (b.utcDateModified ?? "").localeCompare(a.utcDateModified ?? "") || a.noteId.localeCompare(b.noteId));
}

function toHomeItem(note: BNote): HomeItem {
    return { noteId: note.noteId, title: note.title, icon: note.getIcon(), utcDateModified: note.utcDateModified ?? "" };
}

function readJson(noteId: string): unknown {
    const note = becca.notes[noteId];
    if (!note || note.isProtected) {
        return null;
    }
    try {
        return JSON.parse(String(note.getContent()));
    } catch {
        return null;
    }
}

function isEmptyContent(note: BNote) {
    return note.isContentAvailable() && !String(note.getContent()).trim();
}

/** Plain text of a text note body, with block ends and line breaks kept as newlines. */
function htmlToText(html: string) {
    const withBreaks = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, "\n");
    return unescapeHtml(stripTags(withBreaks).replaceAll("&nbsp;", " ")).trim();
}
