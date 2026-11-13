import {
    type ChecklistData, defaultBoard, HELIUM_HOME_CONFIG_NOTE_ID, HELIUM_QUICK_CONFIG_NOTE_ID, HELIUM_QUICK_NOTES_FOLDER_ID,
    type HomeBoard, type HomeData, type QuickNotesData
} from "@triliumnext/commons";
import { beforeAll, describe, expect, it } from "vitest";

import becca from "../../becca/becca";
import { getContext } from "../../services/context";
import hiddenSubtreeService from "../../services/hidden_subtree";
import { createTextNote } from "../../test/api_fixtures";
import { CoreApiTester } from "../../test/api_tester";

let api: CoreApiTester;

describe("Helium Home and Quick Notes API (core)", () => {
    beforeAll(() => {
        api = CoreApiTester.build();
        checkHiddenSubtree();
    });

    describe("setup", () => {
        it("seeds hidden config and one visible capture folder with deterministic IDs", () => {
            expect(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getParentNotes().map((n) => n.noteId)).toEqual([ "_helium" ]);
            expect(becca.getNoteOrThrow("_helium").getParentNotes().map((n) => n.noteId)).toEqual([ "_hidden" ]);
            expect(JSON.parse(String(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent())).recentLimit).toBe(8);
            expect(JSON.parse(String(becca.getNoteOrThrow(HELIUM_QUICK_CONFIG_NOTE_ID).getContent())))
                .toEqual({ schemaVersion: 1, dataNoteId: HELIUM_QUICK_NOTES_FOLDER_ID });

            const folder = becca.getNoteOrThrow(HELIUM_QUICK_NOTES_FOLDER_ID);
            expect(folder.title).toBe("Quick Notes");
            expect(folder.isProtected).toBe(false);
            expect(folder.getParentBranches().map((b) => b.branchId)).toEqual([ `root_${HELIUM_QUICK_NOTES_FOLDER_ID}` ]);
        });

        it("keeps edited config and creates no second folder when the check runs again", () => {
            const edited = JSON.stringify({ schemaVersion: 1, recentLimit: 3 });
            getContext().init(() => becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).setContent(edited));

            checkHiddenSubtree(true);
            checkHiddenSubtree();

            expect(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent()).toBe(edited);
            expect(becca.getNoteOrThrow("root").getChildNotes().filter((n) => n.title === "Quick Notes")).toHaveLength(1);
            getContext().init(() => becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).setContent(""));
            checkHiddenSubtree();
        });

        it("replaces unreadable Quick Notes config on setup instead of staying unconfigured", async () => {
            const config = becca.getNoteOrThrow(HELIUM_QUICK_CONFIG_NOTE_ID);
            const savedConfig = String(config.getContent());
            for (const broken of [ "{ not json", JSON.stringify({ schemaVersion: 2, dataNoteId: "x" }) ]) {
                getContext().init(() => config.setContent(broken));
                expect((await api.get<QuickNotesData>("/api/helium/quick-notes")).body.status).toBe("unconfigured");

                const res = await api.post<QuickNotesData>("/api/helium/quick-notes/setup");
                expect(res.body.status).toBe("ok");
                expect(JSON.parse(String(config.getContent())))
                    .toEqual({ schemaVersion: 1, dataNoteId: HELIUM_QUICK_NOTES_FOLDER_ID });
            }
            expect(becca.getNoteOrThrow("root").getChildNotes().filter((n) => n.title === "Quick Notes")).toHaveLength(1);
            getContext().init(() => config.setContent(savedConfig));
        });

        it("reports a conflict with an unrelated Quick Notes folder instead of claiming it", async () => {
            const config = becca.getNoteOrThrow(HELIUM_QUICK_CONFIG_NOTE_ID);
            const folder = becca.getNoteOrThrow(HELIUM_QUICK_NOTES_FOLDER_ID);
            const savedConfig = String(config.getContent());
            getContext().init(() => config.setContent(""));
            delete becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID];
            const unrelated = await createTextNote(api, { title: "Quick Notes" });
            try {
                const res = await api.post<QuickNotesData>("/api/helium/quick-notes/setup");
                expect(res.body.status).toBe("conflict");
                expect(config.getContent()).toBe("");
                expect(becca.getNoteOrThrow(unrelated.noteId).getChildNotes()).toHaveLength(0);
            } finally {
                becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID] = folder;
                getContext().init(() => {
                    config.setContent(savedConfig);
                    becca.getNoteOrThrow(unrelated.noteId).deleteNote();
                });
            }
        });
    });

    describe("Quick Notes", () => {
        it("captures escaped text as a card titled by its first nonblank line", async () => {
            const res = await api.post<{ note: { noteId: string } }>("/api/helium/quick-notes", {
                body: { text: "\n  <b>Title</b> & co\nsecond line" }
            });
            expect(res.status).toBe(200);
            const note = becca.getNoteOrThrow(res.body.note.noteId);
            expect(note.getParentNotes().map((n) => n.noteId)).toEqual([ HELIUM_QUICK_NOTES_FOLDER_ID ]);
            expect(note.title).toBe("<b>Title</b> & co");
            expect(note.getContent()).toBe("<p>  &lt;b&gt;Title&lt;/b&gt; &amp; co<br>second line</p>");
            expect(note.isProtected).toBe(false);

            const list = await api.get<QuickNotesData>("/api/helium/quick-notes");
            expect(list.body.status).toBe("ok");
            expect(list.body.cards.find((c) => c.noteId === note.noteId)).toMatchObject({
                title: "<b>Title</b> & co", text: "<b>Title</b> & co\nsecond line", pinned: false, archived: false
            });
        });

        it("rejects blank text without creating a note", async () => {
            const before = becca.getNoteOrThrow(HELIUM_QUICK_NOTES_FOLDER_ID).getChildNotes().length;
            const res = await api.post("/api/helium/quick-notes", { body: { text: " \n " } });
            expect(res.status).toBe(400);
            expect(becca.getNoteOrThrow(HELIUM_QUICK_NOTES_FOLDER_ID).getChildNotes()).toHaveLength(before);
        });

        it("lists only unprotected direct text children and leaves the rest untouched", async () => {
            const card = await createTextNote(api, { parentNoteId: HELIUM_QUICK_NOTES_FOLDER_ID, title: "Card" });
            const nested = await createTextNote(api, { parentNoteId: card.noteId, title: "Nested" });
            const secret = await createTextNote(api, { parentNoteId: HELIUM_QUICK_NOTES_FOLDER_ID, title: "Secret" });
            const unrelated = await createTextNote(api, { title: "Unrelated" });
            await withProtected(secret.noteId, async () => {
                const ids = (await api.get<QuickNotesData>("/api/helium/quick-notes")).body.cards.map((c) => c.noteId);
                expect(ids).toContain(card.noteId);
                expect(ids).not.toContain(nested.noteId);
                expect(ids).not.toContain(secret.noteId);
                expect(ids).not.toContain(unrelated.noteId);

                expect((await setState(secret.noteId, "pinned", true)).status).toBe(400);
            });
            expect((await setState(unrelated.noteId, "pinned", true)).status).toBe(400);
            expect((await setState(nested.noteId, "archived", true)).status).toBe(400);
            expect(becca.getNoteOrThrow(nested.noteId).getParentNotes().map((n) => n.noteId)).toEqual([ card.noteId ]);
        });

        it("pins, archives and restores with its own non-inherited labels", async () => {
            const card = await createTextNote(api, { parentNoteId: HELIUM_QUICK_NOTES_FOLDER_ID, title: "Stateful" });
            expect((await setState(card.noteId, "pinned", true)).status).toBe(204);
            expect((await setState(card.noteId, "archived", true)).status).toBe(204);
            expect((await setState(card.noteId, "archived", false)).status).toBe(204);
            expect((await setState(card.noteId, "colour", true)).status).toBe(400);

            const note = becca.getNoteOrThrow(card.noteId);
            expect(note.getOwnedLabelValue("heliumQuickPinned")).toBe("true");
            expect(note.getOwnedLabelValue("heliumQuickArchived")).toBe("false");
            expect(note.getOwnedAttributes().every((attr) => !attr.isInheritable)).toBe(true);
            expect(note.hasOwnedLabel("pinned")).toBe(false);
        });

        it("refuses to save into a protected or missing destination", async () => {
            await withProtected(HELIUM_QUICK_NOTES_FOLDER_ID, async () => {
                expect((await api.get<QuickNotesData>("/api/helium/quick-notes")).body).toEqual({ status: "protected", folderNoteId: null, cards: [] });
                expect((await api.post("/api/helium/quick-notes", { body: { text: "x" } })).status).toBe(400);
            });

            const folder = becca.getNoteOrThrow(HELIUM_QUICK_NOTES_FOLDER_ID);
            const before = folder.getChildNotes().length;
            delete becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID];
            try {
                expect((await api.get<QuickNotesData>("/api/helium/quick-notes")).body.status).toBe("missing");
                expect((await api.post("/api/helium/quick-notes", { body: { text: "x" } })).status).toBe(400);
            } finally {
                becca.notes[HELIUM_QUICK_NOTES_FOLDER_ID] = folder;
            }
            expect(folder.getChildNotes()).toHaveLength(before);
        });
    });

    describe("Home board", () => {
        it("serves the default board for a version 1 config and saves a valid one beside the other settings", async () => {
            setHomeConfig({ schemaVersion: 1, recentLimit: 3 });
            try {
                expect((await api.get<HomeBoard>("/api/helium/home/board")).body).toEqual(defaultBoard());

                const board: HomeBoard = { widgets: [ { id: "c", type: "clock", x: 0, y: 0, w: 2, h: 2, settings: { timeZone: "UTC" } } ], parked: [] };
                expect((await api.put("/api/helium/home/board", { body: { board } })).status).toBe(200);
                const stored = JSON.parse(String(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent()));
                expect(stored).toMatchObject({ schemaVersion: 2, recentLimit: 3, board });
            } finally {
                setHomeConfig(null);
            }
        });

        it("refuses an overlapping layout and keeps a broken stored one readable as the default", async () => {
            const before = String(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent());
            const overlapping = { widgets: [
                { id: "a", type: "clock", x: 0, y: 0, w: 4, h: 2, settings: {} },
                { id: "b", type: "clock", x: 3, y: 1, w: 4, h: 2, settings: {} }
            ], parked: [] };
            expect((await api.put("/api/helium/home/board", { body: { board: overlapping } })).status).toBe(400);
            expect(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent()).toBe(before);

            setHomeConfig({ schemaVersion: 2, recentLimit: 5, board: overlapping });
            try {
                expect((await api.get<HomeBoard>("/api/helium/home/board")).body).toEqual(defaultBoard());
                expect((await api.get<HomeData>("/api/helium/home")).status).toBe(200);
                expect(JSON.parse(String(becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).getContent())).board).toEqual(overlapping);
            } finally {
                setHomeConfig(null);
            }
        });
    });

    describe("Checklist", () => {
        const todo = (text: string, checked = false) =>
            `<li><label class="todo-list__label"><input type="checkbox"${checked ? " checked=\"checked\"" : ""} disabled="disabled"><span class="todo-list__label__description">${text}</span></label></li>`;

        it("lists to-do items and ticks one by changing only its checkbox", async () => {
            const content = `<p>Intro &amp; more</p><ul class="todo-list">${todo("Milk &amp; eggs")}${todo("Bread", true)}</ul>`;
            const note = await createTextNote(api, { title: "Shopping", content });

            const list = (await api.get<ChecklistData>(`/api/helium/checklist/${note.noteId}`)).body;
            expect(list).toEqual({ status: "ok", title: "Shopping", items: [
                { index: 0, text: "Milk & eggs", checked: false },
                { index: 1, text: "Bread", checked: true }
            ] });

            expect((await tick(note.noteId, 0, true, "Milk & eggs")).status).toBe(204);
            expect((await tick(note.noteId, 1, false, "Bread")).status).toBe(204);
            expect(becca.getNoteOrThrow(note.noteId).getContent())
                .toBe(`<p>Intro &amp; more</p><ul class="todo-list">${todo("Milk &amp; eggs").replace("<input", "<input checked=\"checked\"")}${todo("Bread")}</ul>`);
        });

        it("refuses a tick when the item changed since loading, leaving the content as edited", async () => {
            const note = await createTextNote(api, { content: `<ul class="todo-list">${todo("New first")}${todo("Milk")}</ul>` });
            const before = String(becca.getNoteOrThrow(note.noteId).getContent());
            expect((await tick(note.noteId, 0, true, "Milk")).status).toBe(400);
            expect((await tick(note.noteId, 5, true, "Milk")).status).toBe(400);
            expect((await tick(note.noteId, 0, "yes" as unknown as boolean, "New first")).status).toBe(400);
            expect(becca.getNoteOrThrow(note.noteId).getContent()).toBe(before);
        });

        it("never reads or ticks a protected note, even while unlocked", async () => {
            const note = await createTextNote(api, { content: `<ul class="todo-list">${todo("Secret")}</ul>` });
            await withProtected(note.noteId, async () => {
                expect((await api.get<ChecklistData>(`/api/helium/checklist/${note.noteId}`)).body).toEqual({ status: "protected", title: "", items: [] });
                expect((await tick(note.noteId, 0, true, "Secret")).status).toBe(400);
            });
            expect((await api.get<ChecklistData>("/api/helium/checklist/doesNotExist")).body.status).toBe("missing");
        });

        it("creates a Checklist note under root only when asked", async () => {
            const { noteId } = (await api.post<{ noteId: string }>("/api/helium/checklist")).body;
            const note = becca.getNoteOrThrow(noteId);
            expect(note.title).toBe("Checklist");
            expect(note.getParentNotes().map((n) => n.noteId)).toEqual([ "root" ]);
            expect((await api.get<ChecklistData>(`/api/helium/checklist/${noteId}`)).body.items).toHaveLength(1);
        });
    });

    describe("Home", () => {
        it("filters excluded notes before applying the Recent limit", async () => {
            setHomeConfig({ recentLimit: 2 });
            try {
                const eligible = [ await createTextNote(api, { title: "Eligible 1" }), await createTextNote(api, { title: "Eligible 2" }) ];
                const archived = await createTextNote(api, { title: "Archived" });
                const legacy = await createTextNote(api, { title: "Legacy module code" });
                const secret = await createTextNote(api, { title: "Secret" });
                await api.put(`/api/notes/${archived.noteId}/set-attribute`, { body: { type: "label", name: "archived", value: "" } });
                await api.put(`/api/notes/${legacy.noteId}/set-attribute`, { body: { type: "label", name: "heliumModuleId", value: "empyrean.home-panel" } });
                for (const { noteId } of eligible) becca.getNoteOrThrow(noteId).utcDateModified = "2999-01-01 00:00:00.000Z";
                for (const { noteId } of [ archived, legacy, secret ]) becca.getNoteOrThrow(noteId).utcDateModified = "3000-01-01 00:00:00.000Z";

                await withProtected(secret.noteId, async () => {
                    const { recent } = (await api.get<HomeData>("/api/helium/home")).body;
                    expect(recent.map((i) => i.noteId).sort()).toEqual(eligible.map((n) => n.noteId).sort());
                    expect(recent[0]).toMatchObject({ title: expect.stringMatching(/^Eligible/), icon: expect.any(String) });
                });
            } finally {
                setHomeConfig(null);
            }
        });

        it("lists pinned and Inbox notes, deduplicated, without protected ones or Quick Notes pins", async () => {
            const pinned = await createTextNote(api, { title: "Pinned" });
            const quickPinned = await createTextNote(api, { parentNoteId: HELIUM_QUICK_NOTES_FOLDER_ID, title: "Quick pinned" });
            await api.put(`/api/notes/${pinned.noteId}/set-attribute`, { body: { type: "label", name: "pinned", value: "" } });
            await setState(quickPinned.noteId, "pinned", true);
            // A bookmark clones the note into the hidden tree; its visible path keeps it on Home.
            expect((await api.put(`/api/notes/${pinned.noteId}/clone-to-note/_lbBookmarks`, { body: {} })).status).toBe(200);

            const inbox = await createTextNote(api, { title: "Inbox folder" });
            const child = await createTextNote(api, { parentNoteId: inbox.noteId, title: "Inbox child" });
            const secretChild = await createTextNote(api, { parentNoteId: inbox.noteId, title: "Secret child" });
            await api.put(`/api/notes/${inbox.noteId}/set-attribute`, { body: { type: "label", name: "inbox", value: "" } });
            await api.put(`/api/notes/${child.noteId}/set-attribute`, { body: { type: "label", name: "inbox", value: "" } });

            await withProtected(secretChild.noteId, async () => {
                const home = (await api.get<HomeData>("/api/helium/home")).body;
                expect(home.pinned.map((i) => i.noteId)).toEqual([ pinned.noteId ]);
                expect(home.inbox.map((i) => i.noteId).sort()).toEqual([ inbox.noteId, child.noteId ].sort());
            });
        });
    });
});

function checkHiddenSubtree(force = false) {
    getContext().init(() => hiddenSubtreeService.checkHiddenSubtree(force));
}

function tick(noteId: string, index: number, checked: boolean, text: string) {
    return api.put(`/api/helium/checklist/${noteId}/items/${index}`, { body: { checked, text } });
}

function setState(noteId: string, key: string, value: boolean) {
    return api.put(`/api/helium/quick-notes/${noteId}/state`, { body: { key, value } });
}

function setHomeConfig(config: object | null) {
    getContext().init(() => becca.getNoteOrThrow(HELIUM_HOME_CONFIG_NOTE_ID).setContent(config ? JSON.stringify(config) : ""));
    checkHiddenSubtree();
}

/** Marks a note protected in Becca only, as a stand-in for a note protected while unlocked. */
async function withProtected(noteId: string, callback: () => Promise<void>) {
    const note = becca.getNoteOrThrow(noteId);
    note.isProtected = true;
    try {
        await callback();
    } finally {
        note.isProtected = false;
    }
}
