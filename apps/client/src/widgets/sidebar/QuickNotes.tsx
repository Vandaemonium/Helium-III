import "./QuickNotes.css";

import { type QuickNoteCard, type QuickNotesData, type QuickNoteStateKey, selectCards } from "@triliumnext/commons";
import { useSyncExternalStore } from "preact/compat";
import { useContext, useState } from "preact/hooks";

import appContext from "../../components/app_context";
import froca from "../../services/froca";
import { t } from "../../services/i18n";
import server from "../../services/server";
import Button from "../react/Button";
import FormTextArea from "../react/FormTextArea";
import FormTextBox from "../react/FormTextBox";
import { useTriliumEvent } from "../react/hooks";
import LoadingSpinner from "../react/LoadingSpinner";
import NoItems from "../react/NoItems";
import SegmentedChoice from "../react/SegmentedChoice";
import { useFetch } from "../react/use_fetch";
import { quickNotesStore, type QuickNotesSaveStatus } from "./quick_notes_store";
import RightPanelWidget, { NavigatedInNote } from "./RightPanelWidget";

/** The Quick Notes tab: a composer that saves into the Quick Notes folder, and that folder's cards. */
export default function QuickNotes() {
    const state = useSyncExternalStore(quickNotesStore.subscribe, quickNotesStore.getState);
    const [ refreshToken, setRefreshToken ] = useState(0);
    const refresh = () => setRefreshToken((token) => token + 1);
    const { data, failed } = useFetch<QuickNotesData>("helium/quick-notes", refreshToken);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        const folderNoteId = data?.folderNoteId;
        const cardIds = new Set(data?.cards.map((card) => card.noteId));
        const touchesCards = loadResults.getNoteIds().some((noteId) => cardIds.has(noteId) || noteId === folderNoteId)
            || loadResults.getBranchRows().some((branch) => branch.parentNoteId === folderNoteId)
            || loadResults.getAttributeRows().some((attr) => !!attr.noteId && cardIds.has(attr.noteId));
        if (touchesCards || !data || data.status !== "ok") refresh();
    });

    const busy = state.status === "pending";

    return (
        <RightPanelWidget id="quick-notes" title={t("right_pane.tab_quick_notes")} grow>
            <div className="quick-notes">
                <FormTextArea
                    className="quick-notes-composer"
                    currentValue={state.draft}
                    onChange={quickNotesStore.setDraft}
                    disabled={busy}
                    rows={4}
                    aria-label={t("helium_quick_notes.composer_label")}
                    placeholder={t("helium_quick_notes.composer_placeholder")}
                />
                <div className="quick-notes-actions">
                    <Button
                        text={t("helium_quick_notes.save")}
                        kind="primary"
                        disabled={busy || state.status === "uncertain" || data?.status !== "ok"}
                        onClick={() => void quickNotesStore.save()}
                    />
                    {state.status === "uncertain" && (
                        <Button text={t("helium_quick_notes.acknowledge")} onClick={quickNotesStore.acknowledgeUncertain} />
                    )}
                </div>
                <p className="quick-notes-status" role="status" aria-live="polite">{statusMessage(state.status)}</p>

                {data ? (
                    <QuickNotesCards data={data} query={state.query} archived={state.archived} onRetrySetup={async () => {
                        await server.post("helium/quick-notes/setup");
                        refresh();
                    }} />
                ) : failed ? (
                    <NoItems icon="bx bx-error" text={t("helium_quick_notes.load_failed")} size="small" />
                ) : <LoadingSpinner />}
            </div>
        </RightPanelWidget>
    );
}

function QuickNotesCards({ data, query, archived, onRetrySetup }: {
    data: QuickNotesData;
    query: string;
    archived: boolean;
    onRetrySetup: () => void;
}) {
    if (data.status !== "ok") {
        return (
            <NoItems icon="bx bx-error-circle" text={t(`helium_quick_notes.status_${data.status}`)} size="small">
                {(data.status === "conflict" || data.status === "unconfigured") && (
                    <Button text={t("helium_quick_notes.retry_setup")} onClick={onRetrySetup} />
                )}
            </NoItems>
        );
    }

    // A note protected since the last load drops out at once, before the reload confirms it.
    const cards = selectCards(data.cards.filter((card) => !froca.getNoteFromCache(card.noteId)?.isProtected), { query, archived });

    return (
        <>
            <FormTextBox
                type="search"
                currentValue={query}
                onChange={quickNotesStore.setQuery}
                aria-label={t("helium_quick_notes.search")}
                placeholder={t("helium_quick_notes.search")}
            />
            <SegmentedChoice
                options={[
                    { value: "active", label: t("helium_quick_notes.active") },
                    { value: "archived", label: t("helium_quick_notes.archived") }
                ]}
                currentValue={archived ? "archived" : "active"}
                onChange={(value) => quickNotesStore.setArchived(value === "archived")}
            />
            {cards.length ? (
                <ul className="quick-notes-cards">
                    {cards.map((card) => <QuickNoteCardItem key={card.noteId} card={card} />)}
                </ul>
            ) : (
                <NoItems icon="bx bx-note" text={t("helium_quick_notes.empty")} size="small" />
            )}
        </>
    );
}

function QuickNoteCardItem({ card }: { card: QuickNoteCard }) {
    const onNavigated = useContext(NavigatedInNote);
    const [ pending, setPending ] = useState(false);
    const [ error, setError ] = useState(false);

    async function setState(key: QuickNoteStateKey, value: boolean) {
        setPending(true);
        setError(false);
        try {
            await server.put(`helium/quick-notes/${encodeURIComponent(card.noteId)}/state`, { key, value });
        } catch {
            setError(true);
        } finally {
            setPending(false);
        }
    }

    return (
        <li className="quick-notes-card">
            <Button
                kind="lowProfile"
                className="quick-notes-card-open"
                text={card.title}
                onClick={async () => {
                    await appContext.tabManager.getActiveContext()?.setNote(card.noteId);
                    onNavigated?.();
                }}
            />
            <p className="quick-notes-card-preview">{card.text}</p>
            <div className="quick-notes-actions">
                <Button
                    size="small" disabled={pending} aria-pressed={card.pinned}
                    text={card.pinned ? t("helium_quick_notes.unpin") : t("helium_quick_notes.pin")}
                    onClick={() => void setState("pinned", !card.pinned)}
                />
                <Button
                    size="small" disabled={pending} aria-pressed={card.archived}
                    text={card.archived ? t("helium_quick_notes.restore") : t("helium_quick_notes.archive")}
                    onClick={() => void setState("archived", !card.archived)}
                />
            </div>
            {error && <p className="quick-notes-status" role="status">{t("helium_quick_notes.state_failed")}</p>}
        </li>
    );
}

function statusMessage(status: QuickNotesSaveStatus) {
    switch (status) {
        case "blank": return t("helium_quick_notes.blank");
        case "pending": return t("helium_quick_notes.saving");
        case "saved": return t("helium_quick_notes.saved");
        case "failed": return t("helium_quick_notes.failed");
        case "uncertain": return t("helium_quick_notes.uncertain");
        case "retryEnabled": return t("helium_quick_notes.retry_enabled");
        default: return "";
    }
}
