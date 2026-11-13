import type { QuickNotesData } from "@triliumnext/commons";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import options from "../../services/options.js";
import server from "../../services/server.js";
import QuickNotes from "./QuickNotes.js";
import { quickNotesStore } from "./quick_notes_store.js";

let container: HTMLDivElement;

beforeEach(() => {
    quickNotesStore.reset();
    options.set("rightPaneCollapsedItems", "[]");
});

afterEach(() => {
    if (container) {
        act(() => render(null, container));
        container.remove();
    }
    vi.restoreAllMocks();
});

describe("quickNotesStore", () => {
    it("saves once while pending and keeps a draft typed meanwhile", async () => {
        let resolve: (value: unknown) => void = () => {};
        const post = vi.spyOn(server, "postWithSilentErrors").mockImplementation(() => new Promise((r) => { resolve = r; }));

        quickNotesStore.setDraft("First");
        const save = quickNotesStore.save();
        expect(quickNotesStore.getState().status).toBe("pending");
        await quickNotesStore.save();
        quickNotesStore.setDraft("Newer");
        resolve({ note: { noteId: "x" } });
        await save;

        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith("helium/quick-notes", { text: "First" });
        expect(quickNotesStore.getState()).toMatchObject({ status: "saved", draft: "Newer" });

        quickNotesStore.setDraft("Newer");
        resolve = () => {};
        post.mockResolvedValueOnce({});
        await quickNotesStore.save();
        expect(quickNotesStore.getState()).toMatchObject({ status: "saved", draft: "" });
    });

    it("rejects blank text without a request", async () => {
        const post = vi.spyOn(server, "postWithSilentErrors");
        quickNotesStore.setDraft("  \n ");
        await quickNotesStore.save();
        expect(post).not.toHaveBeenCalled();
        expect(quickNotesStore.getState().status).toBe("blank");
    });

    it("keeps the draft on a refusal and allows saving again", async () => {
        const post = vi.spyOn(server, "postWithSilentErrors").mockRejectedValue(JSON.stringify({ message: "folder protected" }));
        quickNotesStore.setDraft("Draft");
        await quickNotesStore.save();
        expect(quickNotesStore.getState()).toMatchObject({ status: "failed", draft: "Draft" });
        await quickNotesStore.save();
        expect(post).toHaveBeenCalledTimes(2);
    });

    it("blocks a retry after an uncertain save until the user confirms checking", async () => {
        const post = vi.spyOn(server, "postWithSilentErrors").mockRejectedValue(new TypeError("network"));
        quickNotesStore.setDraft("Draft");
        await quickNotesStore.save();
        expect(quickNotesStore.getState()).toMatchObject({ status: "uncertain", draft: "Draft" });

        await quickNotesStore.save();
        expect(post).toHaveBeenCalledTimes(1);

        quickNotesStore.acknowledgeUncertain();
        expect(quickNotesStore.getState().status).toBe("retryEnabled");
        await quickNotesStore.save();
        expect(post).toHaveBeenCalledTimes(2);
    });
});

describe("QuickNotes panel", () => {
    const data: QuickNotesData = {
        status: "ok",
        folderNoteId: "heliumQuickNotes",
        cards: [
            { noteId: "a", title: "Alpha <b>", text: "body one", utcDateModified: "2026-01-02", pinned: false, archived: false },
            { noteId: "b", title: "Beta", text: "needle", utcDateModified: "2026-01-01", pinned: true, archived: false },
            { noteId: "c", title: "Gamma", text: "needle", utcDateModified: "2026-01-03", pinned: false, archived: true }
        ]
    };

    async function renderPanel(response: QuickNotesData) {
        vi.spyOn(server, "get").mockResolvedValue(response);
        container ??= document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<QuickNotes />, container));
        for (let round = 0; round < 4; round++) {
            await act(async () => {});
        }
        return container;
    }

    function cardTitles() {
        return [ ...container.querySelectorAll(".quick-notes-card-open") ].map((button) => button.textContent?.trim());
    }

    it("shows active cards pinned first, filters by search and keeps the draft across a remount", async () => {
        await renderPanel(data);
        expect(cardTitles()).toEqual([ "Beta", "Alpha <b>" ]);
        expect(container.querySelector(".quick-notes-card b")).toBeNull();

        act(() => quickNotesStore.setQuery("NEEDLE"));
        expect(cardTitles()).toEqual([ "Beta" ]);
        act(() => quickNotesStore.setArchived(true));
        expect(cardTitles()).toEqual([ "Gamma" ]);

        act(() => quickNotesStore.setDraft("unsaved"));
        act(() => render(null, container));
        await renderPanel(data);
        expect(container.querySelector<HTMLTextAreaElement>(".quick-notes-composer")?.value).toBe("unsaved");
        expect(cardTitles()).toEqual([ "Gamma" ]);
    });

    it("disables saving and lists nothing when the folder is protected", async () => {
        await renderPanel({ status: "protected", folderNoteId: null, cards: [] });
        expect(container.querySelector(".quick-notes-card")).toBeNull();
        expect(container.querySelector(".no-items")).not.toBeNull();
        expect(container.querySelector<HTMLButtonElement>(".quick-notes-actions .btn-primary")?.disabled).toBe(true);
    });
});
