import { textCapture } from "@triliumnext/commons";

import appContext from "../../components/app_context";
import server from "../../services/server";

/**
 * - `pending`: a save is in flight; another cannot start.
 * - `failed`: the server refused the save, so nothing was created.
 * - `uncertain`: no answer came back, so the note might exist; saving again waits for {@link acknowledgeUncertain}.
 * - `retryEnabled`: the user confirmed checking after an uncertain save.
 */
export type QuickNotesSaveStatus = "idle" | "blank" | "pending" | "saved" | "failed" | "uncertain" | "retryEnabled";

export interface QuickNotesState {
    draft: string;
    status: QuickNotesSaveStatus;
    query: string;
    archived: boolean;
}

/**
 * The Quick Notes composer and view state of this window, kept outside the panel so that closing the
 * right pane or the mobile note panel loses neither the draft nor a save in flight. In memory only.
 */
let state: QuickNotesState = { draft: "", status: "idle", query: "", archived: false };
const listeners = new Set<() => void>();

export const quickNotesStore = {
    getState: () => state,

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },

    setDraft: (draft: string) => update({ draft }),
    setQuery: (query: string) => update({ query }),
    setArchived: (archived: boolean) => update({ archived }),

    acknowledgeUncertain() {
        if (state.status === "uncertain") update({ status: "retryEnabled" });
    },

    /** Saves the current draft once; a newer draft typed meanwhile is kept. */
    async save() {
        if (state.status === "pending" || state.status === "uncertain") return;
        const snapshot = state.draft;
        if (!textCapture(snapshot)) {
            update({ status: "blank" });
            return;
        }

        update({ status: "pending" });
        try {
            await server.postWithSilentErrors("helium/quick-notes", { text: snapshot });
            update({ status: "saved", draft: state.draft === snapshot ? "" : state.draft });
        } catch (error) {
            update({ status: isServerRefusal(error) ? "failed" : "uncertain" });
        }
    },

    /** Restores the initial state, for specs. */
    reset() {
        state = { draft: "", status: "idle", query: "", archived: false };
    }
};

// Warns before unloading the window while a draft or an unresolved save would be lost.
appContext.beforeUnloadListeners.push(() => !state.draft && state.status !== "pending" && state.status !== "uncertain");

function update(changes: Partial<QuickNotesState>) {
    state = { ...state, ...changes };
    for (const listener of listeners) listener();
}

/**
 * A save the server answered with an error was rolled back, so nothing was created. Anything else (a
 * dropped connection, a proxy page) leaves the outcome unknown.
 */
function isServerRefusal(error: unknown) {
    if (typeof error !== "string") return false;
    try {
        const body = JSON.parse(error);
        return typeof body?.message === "string";
    } catch {
        return false;
    }
}
