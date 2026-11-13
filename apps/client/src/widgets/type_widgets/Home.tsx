import "./Home.css";

import type { HomeData, HomeItem } from "@triliumnext/commons";
import { useState } from "preact/hooks";

import froca from "../../services/froca";
import { t } from "../../services/i18n";
import { Card, CardSection } from "../react/Card";
import { useTriliumEvent } from "../react/hooks";
import LoadingSpinner from "../react/LoadingSpinner";
import NoItems from "../react/NoItems";
import NoteLink from "../react/NoteLink";
import { useFetch } from "../react/use_fetch";

/** The built-in Home, shown in place of the root note's own view. Read-only. */
export default function Home() {
    const [ refreshToken, setRefreshToken ] = useState(0);
    const { data, failed } = useFetch<HomeData>("helium/home", refreshToken);

    // Any saved note, label or branch can move a note into or out of a section.
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!loadResults.isEmptyForTree()) setRefreshToken((token) => token + 1);
    });

    if (!data) {
        return (
            <div className="helium-home">
                {failed ? <NoItems icon="bx bx-error" text={t("helium_home.load_failed")} /> : <LoadingSpinner />}
            </div>
        );
    }

    return (
        <div className="helium-home">
            <HomeSection heading={t("helium_home.recent")} items={data.recent} emptyText={t("helium_home.recent_empty")} />
            <HomeSection heading={t("helium_home.pinned")} items={data.pinned} emptyText={t("helium_home.pinned_empty")} />
            <HomeSection heading={t("helium_home.inbox")} items={data.inbox} emptyText={t("helium_home.inbox_empty")} />
        </div>
    );
}

function HomeSection({ heading, items, emptyText }: { heading: string; items: HomeItem[]; emptyText: string }) {
    // A note protected since the last load drops out at once, before the reload confirms it.
    const shown = items.filter((item) => !froca.getNoteFromCache(item.noteId)?.isProtected);

    return (
        <Card heading={heading} className="helium-home-section">
            {shown.length ? shown.map((item) => (
                <CardSection key={item.noteId}>
                    <NoteLink notePath={item.noteId} showNoteIcon noPreview />
                </CardSection>
            )) : (
                <CardSection>
                    <NoItems icon="bx bx-note" text={emptyText} size="small" />
                </CardSection>
            )}
        </Card>
    );
}
