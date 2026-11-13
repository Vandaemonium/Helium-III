/**
 * The layout of Helium-III's Home board: widgets placed on a grid of {@link BOARD_COLUMNS} columns,
 * spanning whole cells and never overlapping. Pure helpers, shared by the client and core.
 */

export const BOARD_COLUMNS = 12;
/** The rows a board starts with; the client sizes them to fill the pane. */
export const BOARD_DEFAULT_ROWS = 12;
/** The bottom edge no widget passes, which bounds what a stored layout can claim. */
export const BOARD_MAX_ROWS = 60;
const MAX_WIDGETS = 64;
const MAX_SETTINGS = 12;
const MAX_SETTING_LENGTH = 500;

export interface BoardRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface BoardSize {
    w: number;
    h: number;
}

export interface BoardWidget extends BoardRect {
    /** Unique within the board, parked widgets included. */
    id: string;
    /** The widget type's ID in the client's widget registry. */
    type: string;
    /** Settings of this widget, such as the note a checklist shows. */
    settings: Record<string, string>;
}

export interface HomeBoard {
    widgets: BoardWidget[];
    /** Widgets taken off the board, kept with their settings and last size until put back. */
    parked: BoardWidget[];
}

/** The board a new Home, or one whose stored layout is unreadable, starts with. */
export function defaultBoard(): HomeBoard {
    const widget = (type: string, x: number, y: number, w: number, h: number): BoardWidget => ({ id: type, type, x, y, w, h, settings: {} });
    return {
        widgets: [
            widget("quickNotes", 0, 0, 4, 7),
            widget("checklist", 0, 7, 4, 5),
            widget("calendar", 4, 0, 4, 6),
            widget("recent", 4, 6, 4, 6),
            widget("clock", 8, 0, 4, 2),
            widget("pinned", 8, 2, 4, 4),
            widget("inbox", 8, 6, 4, 3),
            widget("bookmarks", 8, 9, 4, 3)
        ],
        parked: []
    };
}

/**
 * Validates a stored or submitted board. Returns `null` for anything that is not a complete, valid
 * layout: a widget out of bounds, two overlapping, a duplicate ID or malformed settings.
 */
export function normalizeBoard(raw: unknown): HomeBoard | null {
    if (!raw || typeof raw !== "object") return null;
    const { widgets, parked } = raw as Record<string, unknown>;
    if (!Array.isArray(widgets) || !Array.isArray(parked) || widgets.length + parked.length > MAX_WIDGETS) return null;

    const placed = widgets.map(normalizeWidget);
    const drawer = parked.map(normalizeWidget);
    if (placed.includes(null) || drawer.includes(null)) return null;
    const board = { widgets: placed as BoardWidget[], parked: drawer as BoardWidget[] };

    const ids = [ ...board.widgets, ...board.parked ].map((widget) => widget.id);
    if (new Set(ids).size !== ids.length) return null;
    for (const [ index, widget ] of board.widgets.entries()) {
        if (!rectFits(board.widgets.slice(0, index), widget)) return null;
    }
    return board;
}

/** Whether two rectangles share at least one cell. */
export function rectsOverlap(a: BoardRect, b: BoardRect) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Whether `rect` lies on the board and overlaps none of `widgets` except the one `ignoreId` names. */
export function rectFits(widgets: BoardWidget[], rect: BoardRect, ignoreId?: string) {
    return isWholeNumber(rect.x, 0, BOARD_COLUMNS - 1)
        && isWholeNumber(rect.y, 0, BOARD_MAX_ROWS - 1)
        && isWholeNumber(rect.w, 1, BOARD_COLUMNS - rect.x)
        && isWholeNumber(rect.h, 1, BOARD_MAX_ROWS - rect.y)
        && !widgets.some((widget) => widget.id !== ignoreId && rectsOverlap(widget, rect));
}

/**
 * The largest rectangle with its top-left corner at (`x`, `y`) that fits, trying `size` first and
 * shrinking toward `minSize`. Returns `null` when not even `minSize` fits there.
 */
export function fitAt(widgets: BoardWidget[], x: number, y: number, size: BoardSize, minSize: BoardSize): BoardRect | null {
    for (let h = size.h; h >= minSize.h; h--) {
        for (let w = size.w; w >= minSize.w; w--) {
            const rect = { x, y, w, h };
            if (rectFits(widgets, rect)) return rect;
        }
    }
    return null;
}

/** The first free place for a widget, scanning rows from the top, or `null` when the board is full. */
export function findFreeRect(widgets: BoardWidget[], size: BoardSize, minSize: BoardSize): BoardRect | null {
    for (let y = 0; y < BOARD_MAX_ROWS; y++) {
        for (let x = 0; x < BOARD_COLUMNS; x++) {
            const rect = fitAt(widgets, x, y, size, minSize);
            if (rect) return rect;
        }
    }
    return null;
}

/** The widgets in reading order, top row first, for the one-column layout on narrow screens. */
export function boardReadingOrder(widgets: BoardWidget[]) {
    return [ ...widgets ].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The first row below every widget. */
export function boardBottom(widgets: BoardWidget[]) {
    return Math.max(0, ...widgets.map((widget) => widget.y + widget.h));
}

function normalizeWidget(raw: unknown): BoardWidget | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    const { id, type, x, y, w, h } = value;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(id)) return null;
    if (typeof type !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(type)) return null;
    const rect = { x, y, w, h } as BoardRect;
    if (!rectFits([], rect)) return null;
    const settings = normalizeSettings(value.settings ?? {});
    if (!settings) return null;
    return { id, type, x: rect.x, y: rect.y, w: rect.w, h: rect.h, settings };
}

function normalizeSettings(raw: unknown): Record<string, string> | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const entries = Object.entries(raw);
    if (entries.length > MAX_SETTINGS) return null;
    const settings: Record<string, string> = {};
    for (const [ key, value ] of entries) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || typeof value !== "string" || value.length > MAX_SETTING_LENGTH) return null;
        settings[key] = value;
    }
    return settings;
}

function isWholeNumber(value: unknown, min: number, max: number) {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
