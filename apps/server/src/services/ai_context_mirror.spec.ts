import { becca, cls, note_service as noteService } from "@triliumnext/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { AI_CONTEXT_NOTE_ID, childNoteId, MIRROR_LABEL, startAiContextMirror, syncAiContext } from "./ai_context_mirror.js";
import sql_init from "./sql_init.js";

describe("AI-Context mirror", () => {
    let dir: string;
    const write = (name: string, text: string) => fs.writeFileSync(path.join(dir, name), text);
    const sync = () => cls.init(() => syncAiContext(dir));
    const children = () => becca.getNoteOrThrow(AI_CONTEXT_NOTE_ID).getChildNotes().map((n) => n.title);

    beforeAll(async () => {
        sql_init.initializeDb();
        await sql_init.dbReady;
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-context-"));
    });

    it("does nothing while the folder variable is unset or the folder is empty", () => {
        startAiContextMirror(undefined);
        expect(sync()).toBeNull();
        expect(becca.notes[AI_CONTEXT_NOTE_ID]).toBeUndefined();
    });

    it("creates read-only notes in index order, rendered with the Markdown import", () => {
        write("_index.md", "---\ntier: canonical\n---\n\n# Start here\n\n| File | Covers |\n|---|---|\n| `b.md` | B |\n| `a.md` | A |\n");
        write("a.md", "# Alpha\n\n## Section\n\nSee [site](https://example.com).\n");
        write("b.md", "No heading here.\n");
        write("zz.md", "# **Zed** (`zz.md`)\n");

        const result = sync();
        expect(result?.created).toHaveLength(5);
        expect(children()).toEqual([ "Start here", "b", "Alpha", "Zed (zz.md)" ]);

        const index = becca.getNoteOrThrow(childNoteId("_index.md"));
        const content = String(index.getContent());
        expect(content).toContain("<table>");
        expect(content).not.toContain("tier: canonical");
        expect(String(becca.getNoteOrThrow(childNoteId("a.md")).getContent())).toMatch(/<h2>Section<\/h2>.*href="https:\/\/example.com"/s);
        for (const note of [ index, becca.getNoteOrThrow(AI_CONTEXT_NOTE_ID) ]) {
            expect(note.hasOwnedLabel("readOnly") && note.hasOwnedLabel(MIRROR_LABEL) && note.hasOwnedLabel("disableVersioning")).toBe(true);
            expect(note.isProtected).toBe(false);
        }
        expect(String(becca.getNoteOrThrow(AI_CONTEXT_NOTE_ID).getContent())).toContain("Last sync:");
    });

    it("changes nothing, not even the sync time, for unchanged files", () => {
        const parent = becca.getNoteOrThrow(AI_CONTEXT_NOTE_ID);
        const before = parent.getContent();
        expect(sync()).toEqual({ created: [], updated: [], deleted: [] });
        expect(parent.getContent()).toBe(before);
    });

    it("updates a changed file and overwrites an edit made in the app", () => {
        write("a.md", "# Alpha two\n\nNew text.\n");
        const note = becca.getNoteOrThrow(childNoteId("a.md"));
        cls.init(() => becca.getNoteOrThrow(childNoteId("b.md")).setContent("<p>edited</p>"));

        expect(sync()?.updated.sort()).toEqual([ childNoteId("a.md"), childNoteId("b.md") ].sort());
        expect(note.title).toBe("Alpha two");
        expect(String(note.getContent())).toContain("New text.");
        expect(String(becca.getNoteOrThrow(childNoteId("b.md")).getContent())).toContain("No heading here.");
    });

    it("deletes the note of a removed file and recreates it when the file returns", () => {
        fs.rmSync(path.join(dir, "zz.md"));
        expect(sync()?.deleted).toEqual([ childNoteId("zz.md") ]);
        expect(becca.notes[childNoteId("zz.md")]).toBeUndefined();

        write("zz.md", "# Zed again\n");
        expect(sync()?.created).toEqual([ childNoteId("zz.md") ]);
        expect(children()).toContain("Zed again");
    });

    it("never touches user notes, and ignores links, subfolders, large and non-Markdown files", () => {
        const lookalike = cls.init(() => noteService.createNewNote({ parentNoteId: "root", title: "AI-Context", content: "<p>mine</p>", type: "text" }).note);
        const labelled = cls.init(() => noteService.createNewNote({ parentNoteId: "root", title: "x", content: "<p>mine</p>", type: "text", attributes: [ { type: "label", name: MIRROR_LABEL, value: "" } ] }).note);

        const outside = fs.mkdtempSync(path.join(os.tmpdir(), "ai-context-outside-"));
        fs.writeFileSync(path.join(outside, "secret.md"), "# Secret\n");
        fs.symlinkSync(path.join(outside, "secret.md"), path.join(dir, "link.md"));
        fs.mkdirSync(path.join(dir, "sub"));
        write("sub/nested.md", "# Nested\n");
        write("big.md", "x".repeat(2 * 1024 * 1024 + 1));
        write("notes.txt", "# Text\n");

        expect(sync()).toEqual({ created: [], updated: [], deleted: [] });
        expect(becca.notes[childNoteId("big.md")]).toBeUndefined();
        expect(lookalike.getContent()).toBe("<p>mine</p>");
        expect(becca.notes[labelled.noteId]?.isDeleted).toBe(false);
        expect(children()).not.toContain("Secret");
        fs.rmSync(path.join(dir, "big.md"));
    });

    it("leaves a foreign note holding the parent ID alone", () => {
        const parent = becca.getNoteOrThrow(AI_CONTEXT_NOTE_ID);
        const label = parent.getOwnedAttributes("label", MIRROR_LABEL)[0];
        cls.init(() => label.markAsDeleted());
        write("a.md", "# Changed while foreign\n");

        expect(sync()).toBeNull();
        expect(becca.getNoteOrThrow(childNoteId("a.md")).title).toBe("Alpha two");
    });
});
