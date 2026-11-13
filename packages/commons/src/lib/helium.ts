/**
 * Shared types and pure helpers of Helium-III's built-in Home and Quick Notes.
 */

import { defaultBoard, type HomeBoard, normalizeBoard } from "./helium_board.js";

/** The hidden note holding the Home configuration as JSON. */
export const HELIUM_HOME_CONFIG_NOTE_ID = "_heliumHomeConfig";
/** The hidden note holding the Quick Notes configuration as JSON. */
export const HELIUM_QUICK_CONFIG_NOTE_ID = "_heliumQuickConfig";
/** The visible capture folder created by setup. Not underscore-prefixed: it holds user data. */
export const HELIUM_QUICK_NOTES_FOLDER_ID = "heliumQuickNotes";
export const QUICK_PINNED_LABEL = "heliumQuickPinned";
export const QUICK_ARCHIVED_LABEL = "heliumQuickArchived";

export interface HeliumHomeConfig {
    /** 1 had no board; reading it yields the default board. */
    schemaVersion: 2;
    recentLimit: number;
    pinnedLabel: string;
    pinnedLimit: number;
    inboxLabel: string;
    inboxLimit: number;
    excludeHidden: boolean;
    excludeArchived: boolean;
    board: HomeBoard;
}

export const DEFAULT_HOME_CONFIG: Readonly<HeliumHomeConfig> = Object.freeze({
    schemaVersion: 2,
    recentLimit: 8,
    pinnedLabel: "pinned",
    pinnedLimit: 12,
    inboxLabel: "inbox",
    inboxLimit: 10,
    excludeHidden: true,
    excludeArchived: true,
    board: defaultBoard()
});

export interface HeliumQuickConfig {
    schemaVersion: 1;
    dataNoteId: string;
}

export interface HomeItem {
    noteId: string;
    title: string;
    icon: string;
    utcDateModified: string;
}

export interface HomeData {
    recent: HomeItem[];
    pinned: HomeItem[];
    inbox: HomeItem[];
}

export interface QuickNoteCard {
    noteId: string;
    title: string;
    text: string;
    utcDateModified: string;
    pinned: boolean;
    archived: boolean;
}

/**
 * - `ok`: the folder is usable.
 * - `unconfigured`: setup has not stored a folder yet, or the configuration is unreadable.
 * - `conflict`: setup found an unrelated top-level folder with the Quick Notes name.
 * - `missing`: the configured folder is deleted or hidden.
 * - `protected`: the configured folder is protected.
 */
export type QuickNotesStatus = "ok" | "unconfigured" | "conflict" | "missing" | "protected";

export interface QuickNotesData {
    status: QuickNotesStatus;
    folderNoteId: string | null;
    cards: QuickNoteCard[];
}

export type QuickNoteStateKey = "pinned" | "archived";

export interface ChecklistItem {
    /** The item's position among the note's to-do items, which a tick names together with its text. */
    index: number;
    text: string;
    checked: boolean;
}

/**
 * - `missing`: the note is deleted or hidden.
 * - `protected`: the note is protected; Home never shows it, even while unlocked.
 * - `unsupported`: the note is not a text note.
 */
export interface ChecklistData {
    status: "ok" | "missing" | "protected" | "unsupported";
    title: string;
    items: ChecklistItem[];
}

/**
 * Normalizes a stored Home configuration, falling back to defaults for anything invalid. A version 1
 * configuration, or a board that does not validate, gets the default board.
 */
export function normalizeHomeConfig(raw: unknown): HeliumHomeConfig {
    if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_HOME_CONFIG, board: defaultBoard() };
    }
    const value = raw as Record<string, unknown>;
    return {
        schemaVersion: 2,
        board: normalizeBoard(value.board) ?? defaultBoard(),
        recentLimit: clampLimit(value.recentLimit, DEFAULT_HOME_CONFIG.recentLimit),
        pinnedLabel: sanitizeLabelName(value.pinnedLabel, DEFAULT_HOME_CONFIG.pinnedLabel),
        pinnedLimit: clampLimit(value.pinnedLimit, DEFAULT_HOME_CONFIG.pinnedLimit),
        inboxLabel: sanitizeLabelName(value.inboxLabel, DEFAULT_HOME_CONFIG.inboxLabel),
        inboxLimit: clampLimit(value.inboxLimit, DEFAULT_HOME_CONFIG.inboxLimit),
        excludeHidden: value.excludeHidden !== undefined ? Boolean(value.excludeHidden) : DEFAULT_HOME_CONFIG.excludeHidden,
        excludeArchived: value.excludeArchived !== undefined ? Boolean(value.excludeArchived) : DEFAULT_HOME_CONFIG.excludeArchived
    };
}

/**
 * Turns composer text into a note: the first nonblank line is the title, and the whole text is
 * escaped into one paragraph with line breaks. Returns `null` for blank text.
 */
export function textCapture(draft: string): { title: string; content: string } | null {
    const text = String(draft).replace(/\r\n?/g, "\n").replace(/^\n+/, "");
    const title = text.split("\n").find((line) => line.trim())?.trim();
    if (!title) {
        return null;
    }
    const escaped = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
    return { title, content: `<p>${escaped.replaceAll("\n", "<br>")}</p>` };
}

/**
 * The cards of one view (Active or Archived) matching `query` in their title or body, pinned first,
 * then most recently modified, then by note ID.
 */
export function selectCards(cards: QuickNoteCard[], { query = "", archived = false }: { query?: string; archived?: boolean } = {}): QuickNoteCard[] {
    const needle = query.toLocaleLowerCase();
    return cards
        .filter((card) => card.archived === archived && `${card.title}\n${card.text}`.toLocaleLowerCase().includes(needle))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)
            || b.utcDateModified.localeCompare(a.utcDateModified)
            || a.noteId.localeCompare(b.noteId));
}

function clampLimit(value: unknown, fallback: number) {
    const num = Number(value);
    if (value === null || value === "" || !Number.isFinite(num)) {
        return fallback;
    }
    return Math.max(1, Math.min(50, Math.floor(num)));
}

function sanitizeLabelName(name: unknown, fallback: string) {
    if (typeof name !== "string") {
        return fallback;
    }
    return name.trim().replace(/^#/, "").replace(/[^a-zA-Z0-9_:-]/g, "") || fallback;
}
