import type { HomeData } from "@triliumnext/commons";
import { useContext, useEffect, useState } from "preact/hooks";

import froca from "../../../services/froca";
import { t } from "../../../services/i18n";
import { useChildNotes, useNote, useTriliumEvent } from "../../react/hooks";
import LoadingSpinner from "../../react/LoadingSpinner";
import NoItems from "../../react/NoItems";
import NoteAutocomplete from "../../react/NoteAutocomplete";
import NoteLink from "../../react/NoteLink";
import { HomeDataContext, type HomeWidgetProps } from "./registry";

export function RecentWidget() {
    return <HomeSection section="recent" emptyText={t("helium_home.recent_empty")} />;
}

export function PinnedWidget() {
    return <HomeSection section="pinned" emptyText={t("helium_home.pinned_empty")} />;
}

export function InboxWidget() {
    return <HomeSection section="inbox" emptyText={t("helium_home.inbox_empty")} />;
}

/** The notes in the launch bar's bookmarks, in their order there. */
export function BookmarksWidget() {
    const bookmarks = useChildNotes("_lbBookmarks");
    return <NoteList noteIds={bookmarks.map((note) => note.noteId)} emptyText={t("helium_home.bookmarks_empty")} />;
}

/** The results of the search note named by the `noteId` setting. */
export function SavedSearchWidget({ widget, updateSettings }: HomeWidgetProps) {
    const searchNote = useNote(widget.settings.noteId);
    const [ resultIds, setResultIds ] = useState<string[] | null>(null);
    const [ refreshToken, setRefreshToken ] = useState(0);

    useEffect(() => {
        if (!searchNote || searchNote.type !== "search" || searchNote.isProtected) return;
        let current = true;
        void froca.loadSearchNote(searchNote.noteId)
            .then(() => froca.getNotes(searchNote.getChildNoteIds(), true))
            .then((notes) => current && setResultIds(notes.filter((note) => !note.isProtected).map((note) => note.noteId)))
            .catch(() => current && setResultIds([]));
        return () => { current = false; };
    }, [ searchNote, refreshToken ]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!loadResults.isEmptyForTree()) setRefreshToken((token) => token + 1);
    });

    if (!searchNote || searchNote.type !== "search" || searchNote.isProtected) {
        return (
            <div className="helium-widget-setup">
                <NoItems icon="bx bx-search" text={t("helium_home.saved_search_choose")} size="small" />
                <SavedSearchSettings widget={widget} updateSettings={updateSettings} />
            </div>
        );
    }
    if (!resultIds) return <LoadingSpinner />;
    return <NoteList noteIds={resultIds} emptyText={t("helium_home.saved_search_empty")} />;
}

export function SavedSearchSettings({ widget, updateSettings }: HomeWidgetProps) {
    return (
        <NoteAutocomplete
            noteId={widget.settings.noteId}
            placeholder={t("helium_home.saved_search_placeholder")}
            noteIdChanged={(noteId) => updateSettings({ ...widget.settings, noteId })}
        />
    );
}

function HomeSection({ section, emptyText }: { section: keyof HomeData; emptyText: string }) {
    const homeData = useContext(HomeDataContext);
    if (!homeData?.data) {
        return homeData?.failed ? <NoItems icon="bx bx-error" text={t("helium_home.load_failed")} size="small" /> : <LoadingSpinner />;
    }
    return <NoteList noteIds={homeData.data[section].map((item) => item.noteId)} emptyText={emptyText} />;
}

/** Links to notes, leaving out protected ones even while a protected session is open. */
function NoteList({ noteIds, emptyText }: { noteIds: string[]; emptyText: string }) {
    const shown = noteIds.filter((noteId) => !froca.getNoteFromCache(noteId)?.isProtected);
    if (!shown.length) {
        return <NoItems icon="bx bx-note" text={emptyText} size="small" />;
    }
    return (
        <ul className="helium-widget-list">
            {shown.map((noteId) => (
                <li key={noteId}><NoteLink notePath={noteId} showNoteIcon noPreview /></li>
            ))}
        </ul>
    );
}
