import { type BoardWidget, type ChecklistData, defaultBoard, type HomeBoard as HomeBoardModel, type HomeData } from "@triliumnext/commons";
import { render, type VNode } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import appContext from "../../../components/app_context.js";
import date_notes from "../../../services/date_notes.js";
import froca from "../../../services/froca.js";
import server from "../../../services/server.js";
import { buildNote } from "../../../test/easy-froca.js";
import ChecklistWidget from "./ChecklistWidget.js";
import HomeBoard, { emptyCells, keyboardRect, parkWidget, withSettings } from "./HomeBoard.js";
import { openDayNote } from "./HomeCalendar.js";
import { getWidgetType, HOME_WIDGET_TYPES } from "./registry.js";

let container: HTMLDivElement | undefined;

afterEach(() => {
    const root = container;
    if (root) {
        act(() => render(null, root));
        root.remove();
        container = undefined;
    }
    vi.restoreAllMocks();
});

const widget = (id: string, type: string, x: number, y: number, w: number, h: number, settings: Record<string, string> = {}): BoardWidget => ({
    id, type, x, y, w, h, settings
});

async function mount(vnode: VNode) {
    const root = document.createElement("div");
    container = root;
    document.body.appendChild(root);
    act(() => render(vnode, root));
    // The widgets load their modules lazily, and a cold import takes longer than any fixed number of ticks.
    await vi.waitFor(async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        expect(root.querySelector(".bx-loader")).toBeNull();
    }, { timeout: 10_000 });
    return root;
}

function mockGet(responses: Record<string, unknown>) {
    return vi.spyOn(server, "get").mockImplementation(async (url: string) => {
        if (!(url in responses)) throw new Error(`unexpected GET ${url}`);
        return responses[url] as never;
    });
}

describe("widget registry", () => {
    it("knows every default widget, with unique IDs and default sizes no smaller than their minimum", () => {
        const ids = HOME_WIDGET_TYPES.map((type) => type.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const placed of defaultBoard().widgets) {
            const type = getWidgetType(placed.type);
            expect(type, placed.type).toBeDefined();
            expect(placed.w).toBeGreaterThanOrEqual(type?.minSize.w ?? 99);
            expect(placed.h).toBeGreaterThanOrEqual(type?.minSize.h ?? 99);
        }
        for (const type of HOME_WIDGET_TYPES) {
            expect(type.defaultSize.w).toBeGreaterThanOrEqual(type.minSize.w);
            expect(type.defaultSize.h).toBeGreaterThanOrEqual(type.minSize.h);
        }
    });
});

describe("board editing logic", () => {
    it("moves with arrows, resizes with Shift+arrows, and keeps the minimum size and the columns", () => {
        const rect = { x: 0, y: 0, w: 4, h: 3 };
        expect(keyboardRect(rect, "ArrowRight", false, { w: 2, h: 2 })).toEqual({ x: 1, y: 0, w: 4, h: 3 });
        expect(keyboardRect(rect, "ArrowLeft", false, { w: 2, h: 2 })).toEqual(rect);
        expect(keyboardRect(rect, "ArrowDown", true, { w: 2, h: 2 })).toEqual({ x: 0, y: 0, w: 4, h: 4 });
        expect(keyboardRect({ ...rect, h: 2 }, "ArrowUp", true, { w: 2, h: 2 })).toEqual({ x: 0, y: 0, w: 4, h: 2 });
        expect(keyboardRect({ x: 8, y: 0, w: 4, h: 2 }, "ArrowRight", true, { w: 2, h: 2 })).toEqual({ x: 8, y: 0, w: 4, h: 2 });
        expect(keyboardRect(rect, "Enter", false, { w: 2, h: 2 })).toBeNull();
    });

    it("parks a widget with its settings, and offers only free cells", () => {
        const board: HomeBoardModel = { widgets: [ widget("a", "clock", 0, 0, 11, 1), widget("b", "checklist", 0, 1, 12, 1) ], parked: [] };
        expect(emptyCells(board.widgets, 2)).toEqual([ { x: 11, y: 0 } ]);

        const parked = parkWidget(withSettings(board, "b", { noteId: "x" }), "b");
        expect(parked.widgets.map((w) => w.id)).toEqual([ "a" ]);
        expect(parked.parked).toEqual([ widget("b", "checklist", 0, 1, 12, 1, { noteId: "x" }) ]);
    });
});

describe("HomeBoard", () => {
    const item = (noteId: string, title: string) => ({ noteId, title, icon: "bx bx-note", utcDateModified: "2026-01-01" });

    it("renders the stored board, shows titles as text and leaves out notes protected since the load", async () => {
        buildNote({ id: "root", title: "root", children: [
            { id: "recentNote", title: "<img src=x onerror=alert(1)>" },
            { id: "lockedNote", title: "Locked" }
        ] });
        const locked = froca.getNoteFromCache("lockedNote");
        if (!locked) throw new Error("note not built");
        locked.isProtected = true;
        const board: HomeBoardModel = { widgets: [ widget("r", "recent", 0, 0, 4, 4), widget("p", "pinned", 4, 0, 4, 4), widget("x", "gone", 8, 0, 4, 4) ], parked: [] };
        const home: HomeData = { recent: [ item("recentNote", "<img src=x onerror=alert(1)>"), item("lockedNote", "Locked") ], pinned: [], inbox: [] };
        mockGet({ "helium/home/board": board, "helium/home": home });

        const root = await mount(<HomeBoard />);

        const panels = root.querySelectorAll(".helium-board-panel");
        expect([ ...panels ].map((panel) => panel.classList[1])).toEqual([ "helium-widget-recent", "helium-widget-pinned", "helium-widget-gone" ]);
        expect(panels[2].querySelector(".bx-question-mark")).not.toBeNull();
        expect(panels[0].querySelectorAll(".helium-widget-list li")).toHaveLength(1);
        expect(panels[1].querySelector(".no-items")).not.toBeNull();
        expect(root.querySelector("img")).toBeNull();
        expect(root.querySelector(".helium-board-cell")).toBeNull();
    });

    it("parks a widget in edit mode and saves the layout", async () => {
        const board: HomeBoardModel = { widgets: [ widget("c", "clock", 0, 0, 4, 2) ], parked: [] };
        mockGet({ "helium/home/board": board, "helium/home": { recent: [], pinned: [], inbox: [] } });
        const put = vi.spyOn(server, "put").mockResolvedValue({});

        const root = await mount(<HomeBoard />);
        const edit = root.querySelector<HTMLElement>(".helium-board-toolbar .bx-customize")?.closest("button");
        expect(edit).toBeTruthy();
        await act(async () => edit?.click());
        expect(root.querySelectorAll(".helium-board-cell").length).toBe(12 * 12 - 8);

        const park = root.querySelector<HTMLElement>(".helium-board-panel-header .bx-x")?.closest("button");
        expect(park).toBeTruthy();
        await act(async () => park?.click());
        await act(async () => {});

        expect(put).toHaveBeenCalledWith("helium/home/board", { board: { widgets: [], parked: [ board.widgets[0] ] } });
        expect(root.querySelector(".helium-board-drawer .bx-time")).not.toBeNull();
    });
});

describe("Checklist widget", () => {
    it("ticks an item by its index and text, then reloads the list", async () => {
        const data: ChecklistData = { status: "ok", title: "Shopping", items: [ { index: 0, text: "Milk", checked: false }, { index: 1, text: "Bread", checked: true } ] };
        buildNote({ id: "root", title: "root", children: [ { id: "shopping", title: "Shopping" } ] });
        const get = mockGet({ "helium/checklist/shopping": data });
        const put = vi.spyOn(server, "put").mockResolvedValue({});

        const root = await mount(<ChecklistWidget widget={widget("k", "checklist", 0, 0, 4, 4, { noteId: "shopping" })} updateSettings={vi.fn()} />);
        const boxes = root.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
        expect([ ...boxes ].map((box) => box.checked)).toEqual([ false, true ]);

        await act(async () => boxes[0].click());
        await act(async () => {});
        expect(put).toHaveBeenCalledWith("helium/checklist/shopping/items/0", { checked: true, text: "Milk" });
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("creates a Checklist note only on click and stores it in the widget's settings", async () => {
        const post = vi.spyOn(server, "post").mockResolvedValue({ noteId: "newList" });
        const updateSettings = vi.fn();

        const root = await mount(<ChecklistWidget widget={widget("k", "checklist", 0, 0, 4, 4)} updateSettings={updateSettings} />);
        expect(post).not.toHaveBeenCalled();
        const create = root.querySelector<HTMLElement>(".helium-widget-setup .bx-plus")?.closest("button");
        expect(create).toBeTruthy();
        await act(async () => create?.click());
        await act(async () => {});

        expect(post).toHaveBeenCalledWith("helium/checklist");
        expect(updateSettings).toHaveBeenCalledWith({ noteId: "newList" });
    });
});

describe("Calendar widget", () => {
    it("opens the day note through the date notes service", async () => {
        const setNote = vi.fn();
        vi.spyOn(date_notes, "getDayNote").mockResolvedValue({ noteId: "day2026" } as never);
        const app = appContext as unknown as { tabManager: unknown };
        app.tabManager = { getActiveContext: () => ({ setNote }) };
        try {
            await openDayNote("2026-11-12");
        } finally {
            app.tabManager = undefined;
        }

        expect(date_notes.getDayNote).toHaveBeenCalledWith("2026-11-12");
        expect(setNote).toHaveBeenCalledWith("day2026");
    });
});
