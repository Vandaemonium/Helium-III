import type { BoardSize, BoardWidget, HomeData } from "@triliumnext/commons";
import type { ComponentType } from "preact";
import { createContext } from "preact";
import { lazy } from "preact/compat";

import { t } from "../../../services/i18n";
import type { FetchState } from "../../react/use_fetch";

/** What every widget component receives. */
export interface HomeWidgetProps {
    widget: BoardWidget;
    /** Saves new settings for this widget into the board. */
    updateSettings(settings: Record<string, string>): void;
}

/** A widget module: its component, and optionally the settings editor shown from its header. */
interface HomeWidgetModule {
    default: ComponentType<HomeWidgetProps>;
    Settings?: ComponentType<HomeWidgetProps>;
}

export interface HomeWidgetType {
    /** Stored in the board as the widget's `type`; never rename one that has shipped. */
    id: string;
    title: () => string;
    /** A boxicons class, such as `bx bx-time`. */
    icon: string;
    defaultSize: BoardSize;
    minSize: BoardSize;
    /** Whether the widget has a settings editor (its module's `Settings` export). */
    hasSettings?: boolean;
    /** Loads the widget's module when a board first shows it. */
    load: () => Promise<HomeWidgetModule>;
}

/**
 * Every widget type the Home board offers, in the order the widget picker lists them. To add one,
 * see "Home board widgets" in the Developer Guide.
 */
export const HOME_WIDGET_TYPES: HomeWidgetType[] = [
    {
        id: "quickNotes", title: () => t("helium_home.widget_quick_notes"), icon: "bx bx-notepad",
        defaultSize: { w: 4, h: 7 }, minSize: { w: 3, h: 4 },
        load: async () => ({ default: (await import("../../sidebar/QuickNotes")).QuickNotesPanel })
    },
    {
        id: "calendar", title: () => t("helium_home.widget_calendar"), icon: "bx bx-calendar",
        defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 5 },
        load: () => import("./HomeCalendar")
    },
    {
        id: "checklist", title: () => t("helium_home.widget_checklist"), icon: "bx bx-check-square",
        defaultSize: { w: 4, h: 5 }, minSize: { w: 2, h: 2 }, hasSettings: true,
        load: () => import("./ChecklistWidget")
    },
    {
        id: "bookmarks", title: () => t("helium_home.widget_bookmarks"), icon: "bx bx-bookmark",
        defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
        load: async () => ({ default: (await import("./ListWidgets")).BookmarksWidget })
    },
    {
        id: "clock", title: () => t("helium_home.widget_clock"), icon: "bx bx-time",
        defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 2 }, hasSettings: true,
        load: () => import("./ClockWidget")
    },
    {
        id: "recent", title: () => t("helium_home.recent"), icon: "bx bx-history",
        defaultSize: { w: 4, h: 6 }, minSize: { w: 2, h: 2 },
        load: async () => ({ default: (await import("./ListWidgets")).RecentWidget })
    },
    {
        id: "pinned", title: () => t("helium_home.pinned"), icon: "bx bx-pin",
        defaultSize: { w: 4, h: 4 }, minSize: { w: 2, h: 2 },
        load: async () => ({ default: (await import("./ListWidgets")).PinnedWidget })
    },
    {
        id: "inbox", title: () => t("helium_home.inbox"), icon: "bx bx-envelope",
        defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
        load: async () => ({ default: (await import("./ListWidgets")).InboxWidget })
    },
    {
        id: "savedSearch", title: () => t("helium_home.widget_saved_search"), icon: "bx bx-search",
        defaultSize: { w: 4, h: 4 }, minSize: { w: 2, h: 2 }, hasSettings: true,
        load: async () => {
            const { SavedSearchWidget, SavedSearchSettings } = await import("./ListWidgets");
            return { default: SavedSearchWidget, Settings: SavedSearchSettings };
        }
    }
];

export function getWidgetType(id: string) {
    return HOME_WIDGET_TYPES.find((type) => type.id === id);
}

const lazyComponents = new Map<string, { Body: ComponentType<HomeWidgetProps>; Settings: ComponentType<HomeWidgetProps> }>();

/** The lazy body and settings components of a widget type, created once per type. */
export function getLazyWidget(type: HomeWidgetType) {
    let components = lazyComponents.get(type.id);
    if (!components) {
        components = {
            Body: lazy(type.load),
            Settings: lazy(async () => {
                const module = await type.load();
                return { default: module.Settings ?? (() => null) };
            })
        };
        lazyComponents.set(type.id, components);
    }
    return components;
}

/** Recent, Pinned and Inbox read one `helium/home` response, which the board fetches for all of them. */
export const HomeDataContext = createContext<FetchState<HomeData> | null>(null);
