import { describe, expect, it } from "vitest";

import { normalizeHomeConfig } from "./helium.js";
import {
    boardReadingOrder, type BoardWidget, defaultBoard, findFreeRect, fitAt, normalizeBoard, rectFits
} from "./helium_board.js";

const widget = (id: string, x: number, y: number, w: number, h: number, settings: Record<string, string> = {}): BoardWidget => ({
    id, type: "clock", x, y, w, h, settings
});

describe("board layout", () => {
    it("ships a default board that validates, fills twelve columns and overlaps nothing", () => {
        const board = defaultBoard();
        expect(normalizeBoard(board)).toEqual(board);
        expect(board.widgets.map((w) => w.type)).toEqual([
            "quickNotes", "checklist", "calendar", "recent", "clock", "pinned", "inbox", "bookmarks"
        ]);
        expect(board.widgets.reduce((cells, w) => cells + w.w * w.h, 0)).toBe(12 * 12);
    });

    it("fits a rectangle only inside the columns and clear of other widgets", () => {
        const widgets = [ widget("a", 0, 0, 4, 2) ];
        expect(rectFits(widgets, { x: 4, y: 0, w: 8, h: 2 })).toBe(true);
        expect(rectFits(widgets, { x: 3, y: 1, w: 2, h: 2 })).toBe(false);
        expect(rectFits(widgets, { x: 3, y: 1, w: 2, h: 2 }, "a")).toBe(true);
        expect(rectFits(widgets, { x: 5, y: 0, w: 8, h: 1 })).toBe(false);
        expect(rectFits(widgets, { x: -1, y: 3, w: 1, h: 1 })).toBe(false);
        expect(rectFits(widgets, { x: 0.5, y: 3, w: 1, h: 1 })).toBe(false);
        expect(rectFits(widgets, { x: 0, y: 3, w: 0, h: 1 })).toBe(false);
    });

    it("shrinks a new widget toward its minimum size and finds the first free place", () => {
        const widgets = [ widget("a", 0, 0, 4, 2), widget("b", 6, 0, 6, 4) ];
        expect(fitAt(widgets, 4, 0, { w: 4, h: 3 }, { w: 2, h: 2 })).toEqual({ x: 4, y: 0, w: 2, h: 3 });
        expect(fitAt(widgets, 4, 0, { w: 4, h: 3 }, { w: 3, h: 2 })).toBeNull();
        expect(findFreeRect(widgets, { w: 4, h: 2 }, { w: 4, h: 2 })).toEqual({ x: 0, y: 2, w: 4, h: 2 });
    });

    it("orders widgets top row first for the one-column layout", () => {
        const order = boardReadingOrder([ widget("c", 0, 3, 1, 1), widget("b", 5, 0, 1, 1), widget("a", 0, 0, 1, 1) ]);
        expect(order.map((w) => w.id)).toEqual([ "a", "b", "c" ]);
    });

    it("rejects overlapping, out-of-bounds, duplicate or malformed layouts", () => {
        const valid = { widgets: [ widget("a", 0, 0, 4, 2, { noteId: "abc" }) ], parked: [ widget("p", 0, 0, 2, 2) ] };
        expect(normalizeBoard(valid)).toEqual(valid);
        for (const broken of [
            null, "board", { widgets: [] },
            { widgets: [ widget("a", 0, 0, 4, 2), widget("b", 2, 1, 4, 2) ], parked: [] },
            { widgets: [ widget("a", 10, 0, 4, 2) ], parked: [] },
            { widgets: [ widget("a", 0, 0, 1, 1) ], parked: [ widget("a", 0, 0, 1, 1) ] },
            { widgets: [ { ...widget("a", 0, 0, 1, 1), type: "<script>" } ], parked: [] },
            { widgets: [ widget("a", 0, 0, 1, 1, { noteId: 5 } as unknown as Record<string, string>) ], parked: [] },
            { widgets: [ widget("a", 0, 0, 1, 1, JSON.parse("{\"__proto__\":\"x\"}")) ], parked: [] }
        ]) {
            expect(normalizeBoard(broken)).toBeNull();
        }
    });
});

describe("Home config migration", () => {
    it("gives a version 1 config the default board and keeps its other settings", () => {
        const config = normalizeHomeConfig({ schemaVersion: 1, recentLimit: 3, inboxLabel: "todo" });
        expect(config).toMatchObject({ schemaVersion: 2, recentLimit: 3, inboxLabel: "todo" });
        expect(config.board).toEqual(defaultBoard());
    });

    it("falls back to the default board when the stored one is broken, keeping the rest", () => {
        const config = normalizeHomeConfig({ schemaVersion: 2, recentLimit: 4, board: { widgets: [ widget("a", 11, 0, 3, 1) ], parked: [] } });
        expect(config.recentLimit).toBe(4);
        expect(config.board).toEqual(defaultBoard());
    });
});
