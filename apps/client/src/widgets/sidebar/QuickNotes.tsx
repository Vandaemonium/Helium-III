import "./QuickNotes.css";

import { type QuickNoteCard, type QuickNotesData, type QuickNoteStateKey, selectCards } from "@triliumnext/commons";
import { useSyncExternalStore } from "preact/compat";
import clsx from "clsx";
import { useContext, useState } from "preact/hooks";

import appContext from "../../components/app_context";
import froca from "../../services/froca";
import { t } from "../../services/i18n";
import server from "../../services/server";
import ActionButton from "../react/ActionButton";
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
    return (
        <RightPanelWidget id="quick-notes" title={t("right_pane.tab_quick_notes")} grow>
            <QuickNotesPanel />
        </RightPanelWidget>
    );
}

/** The Home board's widget: the panel with a one-line composer and the search behind a button. */
export function HomeQuickNotes() {
    return <QuickNotesPanel compact />;
}

/**
 * The composer and cards, shared by the right pane tab and the Home board's widget through `quickNotesStore`.
 *
 * @param compact shows the composer as one line until it is focused or holds a draft, and the search
 *                only once its button is pressed, so the cards get the height.
 */
export function QuickNotesPanel({ compact }: { compact?: boolean }) {
    const state = useSyncExternalStore(quickNotesStore.subscribe, quickNotesStore.getState);
    const [ focused, setFocused ] = useState(false);
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
    const collapsed = !!compact && !focused && !state.draft && !busy && state.status !== "uncertain";

    return (
        <div className={clsx("quick-notes", { compact, collapsed })}>
            <div
                className="quick-notes-capture"
                onFocusIn={() => setFocused(true)}
                onFocusOut={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
                }}
            >
                <FormTextArea
                    className="quick-notes-composer"
                    currentValue={state.draft}
                    onChange={quickNotesStore.setDraft}
                    onKeyDown={compact ? (e) => {
                        if (e.key === "Escape") e.currentTarget.blur();
                    } : undefined}
                    disabled={busy}
                    rows={collapsed ? 1 : 4}
                    aria-label={t("helium_quick_notes.composer_label")}
                    placeholder={compact ? t("helium_quick_notes.composer_compact_placeholder") : t("helium_quick_notes.composer_placeholder")}
                />
                {!collapsed && (
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
                )}
            </div>
            <p className="quick-notes-status" role="status" aria-live="polite">{statusMessage(state.status)}</p>

            {data ? (
                <QuickNotesCards data={data} query={state.query} archived={state.archived} compact={compact} onRetrySetup={async () => {
                    await server.post("helium/quick-notes/setup");
                    refresh();
                }} />
            ) : failed ? (
                <NoItems icon="bx bx-error" text={t("helium_quick_notes.load_failed")} size="small" />
            ) : <LoadingSpinner />}
        </div>
    );
}

function QuickNotesCards({ data, query, archived, compact, onRetrySetup }: {
    data: QuickNotesData;
    query: string;
    archived: boolean;
    compact?: boolean;
    onRetrySetup: () => void;
}) {
    const [ searchOpen, setSearchOpen ] = useState(false);

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

    const showSearch = !compact || searchOpen || !!query;
    const viewChoice = (
        <SegmentedChoice
            options={[
                { value: "active", label: t("helium_quick_notes.active") },
                { value: "archived", label: t("helium_quick_notes.archived") }
            ]}
            currentValue={archived ? "archived" : "active"}
            onChange={(value) => quickNotesStore.setArchived(value === "archived")}
        />
    );

    return (
        <>
            {showSearch && (
                <FormTextBox
                    type="search"
                    currentValue={query}
                    onChange={quickNotesStore.setQuery}
                    autoFocus={compact}
                    onBlur={compact ? (value) => {
                        if (!value) setSearchOpen(false);
                    } : undefined}
                    onKeyDown={compact ? (e) => {
                        if (e.key !== "Escape") return;
                        quickNotesStore.setQuery("");
                        setSearchOpen(false);
                    } : undefined}
                    aria-label={t("helium_quick_notes.search")}
                    placeholder={t("helium_quick_notes.search")}
                />
            )}
            {compact ? (
                <div className="quick-notes-filters">
                    {viewChoice}
                    {!showSearch && (
                        <ActionButton
                            icon="bx bx-search" className="quick-notes-search-toggle"
                            text={t("helium_quick_notes.search")}
                            onClick={() => setSearchOpen(true)}
                        />
                    )}
                </div>
            ) : viewChoice}
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

    const preview = cardPreview(card);
    const pinLabel = card.pinned ? t("helium_quick_notes.unpin") : t("helium_quick_notes.pin");
    const archiveLabel = card.archived ? t("helium_quick_notes.restore") : t("helium_quick_notes.archive");

    return (
        <li className={clsx("quick-notes-card", { pinned: card.pinned })}>
            <Button
                kind="lowProfile"
                className="quick-notes-card-open"
                text={<>
                    <span className="quick-notes-card-title">{card.title}</span>
                    {preview && <span className="quick-notes-card-preview">{preview}</span>}
                </>}
                onClick={async () => {
                    await appContext.tabManager.getActiveContext()?.setNote(card.noteId);
                    onNavigated?.();
                }}
            />
            <div className="quick-notes-card-actions">
                <ActionButton
                    icon={card.pinned ? "bx bxs-pin" : "bx bx-pin"}
                    className="quick-notes-pin"
                    text={pinLabel} aria-label={pinLabel}
                    disabled={pending} aria-pressed={card.pinned}
                    onClick={() => void setState("pinned", !card.pinned)}
                />
                <ActionButton
                    icon={card.archived ? "bx bx-archive-out" : "bx bx-archive-in"}
                    className="quick-notes-archive"
                    text={archiveLabel} aria-label={archiveLabel}
                    disabled={pending} aria-pressed={card.archived}
                    onClick={() => void setState("archived", !card.archived)}
                />
            </div>
            {error && <p className="quick-notes-status" role="status">{t("helium_quick_notes.state_failed")}</p>}
        </li>
    );
}

/** The card's body as one line, without the first line when it only repeats the title. */
export function cardPreview({ title, text }: Pick<QuickNoteCard, "title" | "text">) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines[0] === title.trim()) {
        lines.shift();
    }
    return lines.join(" ");
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
