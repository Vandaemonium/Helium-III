import { useCallback, useEffect, useState } from "trilium:preact";

const PANEL_STYLES = `
.helium-home-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    font-family: var(--main-font-family, inherit);
    color: var(--main-text-color, inherit);
}
.helium-home-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid var(--main-border-color, rgba(128, 128, 128, 0.25));
    padding-bottom: 10px;
}
.helium-home-title-group {
    display: flex;
    align-items: baseline;
    gap: 10px;
}
.helium-home-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
}
.helium-home-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accented-background-color, rgba(128, 128, 128, 0.15));
    color: var(--muted-text-color, inherit);
}
.helium-home-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.helium-home-btn {
    cursor: pointer;
    border: 1px solid var(--main-border-color, rgba(128, 128, 128, 0.35));
    background: var(--button-background-color, transparent);
    color: var(--button-text-color, inherit);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.82rem;
}
.helium-home-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
}
.helium-home-section {
    border: 1px solid var(--main-border-color, rgba(128, 128, 128, 0.25));
    border-radius: 8px;
    padding: 12px 14px;
    background: var(--more-accented-background-color, rgba(128, 128, 128, 0.04));
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.helium-home-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.95rem;
}
.helium-home-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.helium-home-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 6px;
    border-radius: 5px;
}
.helium-home-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--link-color, inherit);
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-align: left;
}
.helium-home-meta {
    font-size: 0.75rem;
    color: var(--muted-text-color, #888);
    white-space: nowrap;
}
.helium-home-empty {
    font-size: 0.85rem;
    color: var(--muted-text-color, #888);
    font-style: italic;
    margin: 4px 0;
}
`;

function formatShortTimestamp(utcStr) {
    if (!utcStr || typeof utcStr !== "string") {
        return "";
    }
    return utcStr.slice(0, 16).replace("T", " ");
}

function NoteSection({ title, subtitle, items, emptyMessage, onOpenNote }) {
    return (
        <section className="helium-home-section">
            <div className="helium-home-section-header">
                <span>{title}</span>
                <span className="helium-home-meta">{subtitle}</span>
            </div>
            {items.length === 0 ? (
                <p className="helium-home-empty">{emptyMessage}</p>
            ) : (
                <ul className="helium-home-list">
                    {items.map((item) => (
                        <li key={item.noteId} className="helium-home-item">
                            <button
                                type="button"
                                className="helium-home-link"
                                onClick={(e) => onOpenNote(item.noteId, e)}
                                title={`Open ${item.title}`}
                            >
                                <span className={item.icon || "tn-icon bx bx-note"} />
                                <span>{item.title}</span>
                            </button>
                            {item.utcDateModified ? (
                                <span className="helium-home-meta">
                                    {formatShortTimestamp(item.utcDateModified)}
                                </span>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function HeliumHomePanel() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        data: null
    });

    const refresh = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const data = await HomePanelQueries.loadHomePanelData(api);
            setState({ loading: false, error: null, data });
        } catch (err) {
            setState({
                loading: false,
                error: err instanceof Error ? err.message : String(err),
                data: null
            });
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleOpenNote = useCallback((noteId, event) => {
        if (event && (event.ctrlKey || event.metaKey)) {
            void api.openTabWithNote(noteId, true);
        } else if (event && event.shiftKey) {
            void api.openSplitWithNote(noteId, true);
        } else {
            void api.activateNote(noteId);
        }
    }, []);

    const data = state.data;
    const config = data?.config || HomePanelQueries.DEFAULT_CONFIG;

    return (
        <div className="helium-home-panel" data-module-id="empyrean.home-panel" data-module-version="0.1.0">
            <style>{PANEL_STYLES}</style>
            <header className="helium-home-header">
                <div className="helium-home-title-group">
                    <h2 className="helium-home-title">Helium-III Home</h2>
                    <span className="helium-home-badge">empyrean.home-panel v0.1.0</span>
                </div>
                <div className="helium-home-actions">
                    {data?.configNoteId ? (
                        <button
                            type="button"
                            className="helium-home-btn"
                            onClick={(e) => handleOpenNote(data.configNoteId, e)}
                        >
                            Configure
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="helium-home-btn"
                        onClick={() => void refresh()}
                        disabled={state.loading}
                    >
                        {state.loading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </header>

            {state.error ? (
                <div className="helium-home-section">
                    <strong>Home Panel Error:</strong> <span>{state.error}</span>
                </div>
            ) : null}

            <div className="helium-home-grid">
                <NoteSection
                    title="Pinned Notes"
                    subtitle={`#${config.pinnedLabel}`}
                    items={data?.pinned || []}
                    emptyMessage={`No notes tagged #${config.pinnedLabel} yet.`}
                    onOpenNote={handleOpenNote}
                />
                <NoteSection
                    title="Inbox"
                    subtitle={`#${config.inboxLabel}`}
                    items={data?.inbox || []}
                    emptyMessage={`No notes in #${config.inboxLabel} yet.`}
                    onOpenNote={handleOpenNote}
                />
                <NoteSection
                    title="Recent Notes"
                    subtitle={`Latest ${config.recentLimit}`}
                    items={data?.recent || []}
                    emptyMessage="No recent user notes found."
                    onOpenNote={handleOpenNote}
                />
            </div>
        </div>
    );
}
