import type { Request } from "../../http_interface";
import { createQuickNote, getHomeData, getQuickNotes, retryQuickNotesSetup, setQuickNoteState } from "../../services/helium.js";

function createQuickNoteRoute(req: Request) {
    return createQuickNote(req.body?.text);
}

function setQuickNoteStateRoute(req: Request<{ noteId: string }>) {
    setQuickNoteState(req.params.noteId, req.body?.key, req.body?.value);
}

export default {
    getHome: () => getHomeData(),
    getQuickNotes: () => getQuickNotes(),
    createQuickNote: createQuickNoteRoute,
    setQuickNoteState: setQuickNoteStateRoute,
    retrySetup: () => retryQuickNotesSetup()
};
