import type { HomeData } from "@triliumnext/commons";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import froca from "../../services/froca.js";
import server from "../../services/server.js";
import { buildNote } from "../../test/easy-froca.js";
import Home from "./Home.js";

let container: HTMLDivElement;

afterEach(() => {
    act(() => render(null, container));
    container.remove();
    vi.restoreAllMocks();
});

async function renderHome(data: HomeData) {
    vi.spyOn(server, "get").mockResolvedValue(data);
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => render(<Home />, container));
    for (let round = 0; round < 4; round++) {
        await act(async () => {});
    }
    return container;
}

describe("Home", () => {
    it("shows the three sections with native links, inert titles and empty states", async () => {
        buildNote({ id: "root", title: "root", children: [
            { id: "recentNote", title: "<img src=x onerror=alert(1)>" },
            { id: "lockedNote", title: "Locked" }
        ] });
        const item = (noteId: string, title: string) => ({ noteId, title, icon: "bx bx-note", utcDateModified: "2026-01-01" });

        const home = await renderHome({
            recent: [ item("recentNote", "<img src=x onerror=alert(1)>"), item("lockedNote", "Locked") ],
            pinned: [],
            inbox: []
        });

        const [ recent, pinned, inbox ] = home.querySelectorAll(".helium-home-section");
        expect(recent.querySelectorAll(".tn-card-section")).toHaveLength(2);
        expect(recent.querySelector(".no-items")).toBeNull();
        expect(pinned.querySelector(".no-items")).not.toBeNull();
        expect(inbox.querySelector(".no-items")).not.toBeNull();
        expect(home.querySelector("img")).toBeNull();
        expect(server.get).toHaveBeenCalledWith("helium/home");
    });

    it("drops a note protected since the last load without waiting for the reload", async () => {
        buildNote({ id: "root", title: "root", children: [ { id: "nowProtected", title: "Secret" } ] });
        const note = froca.getNoteFromCache("nowProtected");
        if (!note) throw new Error("note not built");
        note.isProtected = true;

        const home = await renderHome({
            recent: [ { noteId: "nowProtected", title: "Secret", icon: "bx bx-note", utcDateModified: "2026-01-01" } ],
            pinned: [],
            inbox: []
        });

        const recent = home.querySelector(".helium-home-section");
        expect(recent?.querySelectorAll(".tn-card-section")).toHaveLength(1);
        expect(recent?.querySelector(".no-items")).not.toBeNull();
    });
});
