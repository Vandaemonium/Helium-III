import type { ChecklistData, ChecklistItem } from "@triliumnext/commons";
import { useState } from "preact/hooks";

import { t } from "../../../services/i18n";
import server from "../../../services/server";
import Button from "../../react/Button";
import FormCheckbox from "../../react/FormCheckbox";
import { useTriliumEvent } from "../../react/hooks";
import LoadingSpinner from "../../react/LoadingSpinner";
import NoItems from "../../react/NoItems";
import NoteAutocomplete from "../../react/NoteAutocomplete";
import NoteLink from "../../react/NoteLink";
import { useFetch } from "../../react/use_fetch";
import type { HomeWidgetProps } from "./registry";

/** The to-do items of the text note named by the `noteId` setting, which ticking writes back to. */
export default function ChecklistWidget(props: HomeWidgetProps) {
    const noteId = props.widget.settings.noteId;
    if (!noteId) {
        return <ChecklistSetup {...props} />;
    }
    return <Checklist key={noteId} noteId={noteId} {...props} />;
}

export function Settings({ widget, updateSettings }: HomeWidgetProps) {
    return (
        <NoteAutocomplete
            noteId={widget.settings.noteId}
            placeholder={t("helium_home.checklist_placeholder")}
            noteIdChanged={(noteId) => updateSettings({ ...widget.settings, noteId })}
        />
    );
}

function Checklist({ noteId, ...props }: HomeWidgetProps & { noteId: string }) {
    const [ refreshToken, setRefreshToken ] = useState(0);
    const refresh = () => setRefreshToken((token) => token + 1);
    const { data, failed } = useFetch<ChecklistData>(`helium/checklist/${encodeURIComponent(noteId)}`, refreshToken);
    const [ pending, setPending ] = useState<number | null>(null);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (loadResults.isNoteContentReloaded(noteId) || loadResults.isNoteReloaded(noteId)) refresh();
    });

    if (!data) {
        return failed ? <NoItems icon="bx bx-error" text={t("helium_home.checklist_load_failed")} size="small" /> : <LoadingSpinner />;
    }
    if (data.status !== "ok") {
        return (
            <div className="helium-widget-setup">
                <NoItems icon="bx bx-error-circle" text={t(`helium_home.checklist_status_${data.status}`)} size="small" />
                <Settings {...props} />
            </div>
        );
    }

    async function tick(item: ChecklistItem, checked: boolean) {
        setPending(item.index);
        try {
            // The server refuses the tick if the item changed meanwhile, and the reload shows the current list.
            await server.put(`helium/checklist/${encodeURIComponent(noteId)}/items/${item.index}`, { checked, text: item.text });
        } catch {
            // `server.put()` has already shown the refusal as a toast.
        } finally {
            setPending(null);
            refresh();
        }
    }

    return (
        <div className="helium-checklist">
            <NoteLink notePath={noteId} showNoteIcon noPreview />
            {data.items.length ? (
                <ul className="helium-widget-list">
                    {data.items.map((item) => (
                        <li key={`${item.index}-${item.text}`}>
                            <FormCheckbox
                                label={item.text || t("helium_home.checklist_untitled")}
                                currentValue={item.checked}
                                disabled={pending !== null}
                                onChange={(checked) => void tick(item, checked)}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <NoItems icon="bx bx-check-square" text={t("helium_home.checklist_empty")} size="small" />
            )}
        </div>
    );
}

function ChecklistSetup(props: HomeWidgetProps) {
    const [ creating, setCreating ] = useState(false);

    return (
        <div className="helium-widget-setup">
            <NoItems icon="bx bx-check-square" text={t("helium_home.checklist_choose")} size="small" />
            <Settings {...props} />
            <Button
                text={t("helium_home.checklist_create")}
                icon="bx bx-plus"
                disabled={creating}
                onClick={async () => {
                    setCreating(true);
                    try {
                        const { noteId } = await server.post<{ noteId: string }>("helium/checklist");
                        props.updateSettings({ ...props.widget.settings, noteId });
                    } finally {
                        setCreating(false);
                    }
                }}
            />
        </div>
    );
}
