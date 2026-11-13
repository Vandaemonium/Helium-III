import type { Request } from "../../http_interface";
import {
    createChecklistNote, createQuickNote, getChecklist, getHomeConfig, getHomeData, getQuickNotes, retryQuickNotesSetup,
    saveHomeBoard, setChecklistItem, setQuickNoteState
} from "../../services/helium.js";

function createQuickNoteRoute(req: Request) {
    return createQuickNote(req.body?.text);
}

function setQuickNoteStateRoute(req: Request<{ noteId: string }>) {
    setQuickNoteState(req.params.noteId, req.body?.key, req.body?.value);
}

function setChecklistItemRoute(req: Request<{ noteId: string; index: string }>) {
    setChecklistItem(req.params.noteId, Number(req.params.index), req.body?.checked, req.body?.text);
}

export default {
    getHome: () => getHomeData(),
    getBoard: () => getHomeConfig().board,
    saveBoard: (req: Request) => saveHomeBoard(req.body?.board),
    getChecklist: (req: Request<{ noteId: string }>) => getChecklist(req.params.noteId),
    setChecklistItem: setChecklistItemRoute,
    createChecklist: () => createChecklistNote(),
    getQuickNotes: () => getQuickNotes(),
    createQuickNote: createQuickNoteRoute,
    setQuickNoteState: setQuickNoteStateRoute,
    retrySetup: () => retryQuickNotesSetup()
};
