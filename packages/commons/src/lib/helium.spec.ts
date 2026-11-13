import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_CONFIG, normalizeHomeConfig, type QuickNoteCard, selectCards, textCapture } from "./helium.js";

describe("textCapture", () => {
    it("takes the first nonblank line as title and escapes the body", () => {
        expect(textCapture("\r\n\n  \n  Title <b>&</b>\r\nsecond 'x' \"y\"")).toEqual({
            title: "Title <b>&</b>",
            content: "<p>  <br>  Title &lt;b&gt;&amp;&lt;/b&gt;<br>second &#39;x&#39; &quot;y&quot;</p>"
        });
    });

    it("rejects blank text", () => {
        expect(textCapture("")).toBeNull();
        expect(textCapture(" \n\t\n ")).toBeNull();
    });
});

describe("selectCards", () => {
    const card = (noteId: string, extra: Partial<QuickNoteCard>): QuickNoteCard => ({
        noteId, title: noteId, text: "", utcDateModified: "2026-01-01", pinned: false, archived: false, ...extra
    });
    const cards = [
        card("a", { utcDateModified: "2026-01-02" }),
        card("b", { utcDateModified: "2026-01-03" }),
        card("c", { pinned: true }),
        card("d", { archived: true, text: "Needle in body" }),
        card("e", { utcDateModified: "2026-01-02" })
    ];

    it("puts pinned first, then newest, then breaks ties by note ID", () => {
        expect(selectCards(cards).map((c) => c.noteId)).toEqual([ "c", "b", "a", "e" ]);
    });

    it("searches title and body case-insensitively within the selected view only", () => {
        expect(selectCards(cards, { query: "needle" }).map((c) => c.noteId)).toEqual([]);
        expect(selectCards(cards, { query: "NEEDLE", archived: true }).map((c) => c.noteId)).toEqual([ "d" ]);
    });
});

describe("normalizeHomeConfig", () => {
    it("keeps valid values, clamps limits and sanitizes labels", () => {
        expect(normalizeHomeConfig({ recentLimit: 500, pinnedLimit: "3", pinnedLabel: "#fav orite", inboxLabel: 5, excludeArchived: false }))
            .toEqual({ ...DEFAULT_HOME_CONFIG, recentLimit: 50, pinnedLimit: 3, pinnedLabel: "favorite", excludeArchived: false });
    });

    it("falls back to defaults for malformed input", () => {
        expect(normalizeHomeConfig(null)).toEqual(DEFAULT_HOME_CONFIG);
        expect(normalizeHomeConfig({ recentLimit: "x", pinnedLabel: "###" })).toEqual(DEFAULT_HOME_CONFIG);
    });
});
