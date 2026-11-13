import "./global_menu.css";

import { KeyboardActionNames } from "@triliumnext/commons";
import { ComponentChildren, RefObject } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

import { CommandNames } from "../../components/app_context";
import Component from "../../components/component";
import type { MenuCommandItem } from "../../menus/context_menu";
import {
    COLOR_SCHEME_CYCLE, COLOR_SCHEME_ICONS, ColorScheme, resolveColorScheme, THEME_FAMILY_SCHEMES
} from "../../services/color_scheme";
import { t } from "../../services/i18n";
import utils, { isElectron, isMobile, isStandalone } from "../../services/utils";
import Dropdown from "../react/Dropdown";
import { FormDropdownDivider, FormDropdownSubmenu, FormListHeader, FormListItem } from "../react/FormList";
import {
    useStaticTooltip, useStaticTooltipWithKeyboardShortcut, useTriliumOption, useTriliumOptionBool,
    useUserThemes
} from "../react/hooks";
import { MenuItemRows } from "../react/Menu";
import { ParentComponent } from "../react/react_utils";

interface MenuItemProps<T> {
    icon: string,
    text: ComponentChildren,
    title?: string,
    command: T,
    disabled?: boolean
    active?: boolean;
    outsideChildren?: ComponentChildren;
    keyboardShortcut?: KeyboardActionNames;
}

export default function GlobalMenu({ isHorizontalLayout }: { isHorizontalLayout: boolean }) {
    const isVerticalLayout = !isHorizontalLayout;
    const parentComponent = useContext(ParentComponent);
    const { isUpdateAvailable, latestVersion } = useTriliumUpdateStatus();
    const logoRef = useRef<SVGSVGElement>(null);
    useStaticTooltip(logoRef);
    const commandAction = (command: CommandNames, uiIcon: string, title: string): MenuCommandItem<CommandNames> => ({
        title, uiIcon, handler: () => void parentComponent?.triggerCommand(command)
    });
    /** Drawn as a strip of cards at the top of the menu on a phone. */
    const mobileActions = [
        commandAction("searchNotes", "bx bx-search", t("global_menu.search_notes")),
        commandAction("showRecentChanges", "bx bx-history", t("recent_changes.title")),
        commandAction("showDeletedNotes", "bx bx-trash-alt", t("global_menu.show_deleted_notes"))
    ];

    return (
        <Dropdown
            className="global-menu"
            buttonClassName={`global-menu-button ${isHorizontalLayout ? "bx bx-menu" : ""}`} noSelectButtonStyle iconAction hideToggleArrow
            text={<>
                {isVerticalLayout && <VerticalLayoutIcon logoRef={logoRef} />}
                {isUpdateAvailable && <div class="global-menu-button-update-available">
                    <span className="bx bxs-down-arrow-alt global-menu-button-update-available-button" title={t("update_available.update_available")} />
                </div>}
            </>}
            mobileBackdrop
        >
            {isMobile() ? (
                <MenuItemRows items={[ { kind: "actions", items: mobileActions, className: "global-menu-strip tn-menu-actions-cards" } ]} />
            ) : <>
                <MenuItem command="openNewWindow" icon="bx bx-window-open" text={t("global_menu.open_new_window")} />
                <MenuItem command="showDeletedNotes" icon="bx bx-trash-alt" text={t("global_menu.show_deleted_notes")} />
                <FormDropdownDivider />
            </>}

            {isMobile() ? (
                <MenuItemColumns>
                    <MenuItem command="toggleFullscreen" icon="bx bx-expand-alt" text={t("global_menu.fullscreen")} />
                    <MenuItem command="toggleZenMode" icon="bx bxs-yin-yang" text={t("global_menu.toggle-zen-mode")} />
                </MenuItemColumns>
            ) : <>
                <ZoomControls parentComponent={parentComponent} />
                <ToggleWindowOnTop />
                <KeyboardActionMenuItem command="toggleZenMode" icon="bx bxs-yin-yang" text={t("global_menu.toggle-zen-mode")} />
            </>}
            <FormDropdownDivider />

            {!isMobile() && <SwitchToOptions />}
            <MenuItem command="showLaunchBarSubtree" icon={`bx ${isMobile() ? "bx-mobile" : "bx-sidebar"}`} text={t("global_menu.configure_launchbar")} />
            {!isMobile() && <ThemeMenu />}
            <AdvancedMenu />
            <MenuItem command="showOptions" icon="bx bx-cog" text={t("global_menu.options")} />
            <FormDropdownDivider />

            <KeyboardActionMenuItem command="showHelp" icon="bx bx-help-circle" text={t("global_menu.show_help")} />
            {!isMobile() && <KeyboardActionMenuItem command="showCheatsheet" icon="bx bxs-keyboard" text={t("global_menu.show-cheatsheet")} />}
            <MenuItem command="openAboutDialog" icon="bx bx-info-circle" text={t("global_menu.about")} />

            {isUpdateAvailable &&  <>
                <FormListHeader text={t("global_menu.new-version-available")} />
                <MenuItem command={() => window.open("https://github.com/TriliumNext/Trilium/releases/latest")}
                    icon="bx bx-download"
                    text={t("global_menu.download-update", {latestVersion})} />
            </>}

            {!isElectron() && !isStandalone && <BrowserOnlyOptions />}
        </Dropdown>
    );
}

/** Picks the color scheme and the theme. */
function ThemeMenu() {
    const [ theme, setTheme ] = useTriliumOption("theme");
    const userThemes = useUserThemes();
    const { family, scheme, isCustom } = resolveColorScheme(theme);
    const schemeLabels: Record<ColorScheme, string> = {
        system: t("theme.color_scheme_system"),
        light: t("theme.color_scheme_light"),
        dark: t("theme.color_scheme_dark")
    };

    return (
        <FormDropdownSubmenu icon="bx bx-palette" title={t("global_menu.theme")}>
            <FormListHeader text={t("theme.color_scheme")} />
            {COLOR_SCHEME_CYCLE.map((value) => (
                <FormListItem
                    key={value}
                    icon={COLOR_SCHEME_ICONS[value]}
                    checkable
                    checked={!isCustom && scheme === value}
                    disabled={isCustom}
                    disabledTooltip={t("theme.color_scheme_custom_disabled")}
                    onClick={() => {
                        if (family) void setTheme(THEME_FAMILY_SCHEMES[family][value]);
                    }}
                >
                    {schemeLabels[value]}
                </FormListItem>
            ))}

            <FormListHeader text={t("global_menu.theme")} />
            <FormListItem
                icon="bx bx-planet"
                checkable
                checked={family === "empyrean"}
                onClick={() => void setTheme(THEME_FAMILY_SCHEMES.empyrean[scheme])}
            >
                {t("theme.empyrean_themes")}
            </FormListItem>
            <FormListItem
                icon="bx bx-star"
                checkable
                checked={family === "modern"}
                onClick={() => void setTheme(THEME_FAMILY_SCHEMES.modern[scheme])}
            >
                {t("theme.modern_themes")}
            </FormListItem>
            {userThemes.map((userTheme) => (
                <FormListItem
                    key={userTheme.val}
                    icon={userTheme.icon}
                    checkable
                    checked={theme === userTheme.val}
                    onClick={() => void setTheme(userTheme.val)}
                >
                    {userTheme.title}
                </FormListItem>
            ))}
        </FormDropdownSubmenu>
    );
}

function AdvancedMenu() {
    return (
        <FormDropdownSubmenu icon="bx bx-chip" title={t("global_menu.advanced")}>
            <MenuItem command="showShareSubtree" icon="bx bx-share-alt" text={t("global_menu.show_shared_notes_subtree")} />
            <KeyboardActionMenuItem command="showSpaceUsage" icon="bx bx-pie-chart-alt-2" text={t("global_menu.show_space_usage")} />
            <MenuItem command="showHiddenSubtree" icon="bx bx-hide" text={t("global_menu.show_hidden_subtree")} />
            <MenuItem command="showSearchHistory" icon="bx bx-search-alt" text={t("global_menu.open_search_history")} />
            <FormDropdownDivider />

            <KeyboardActionMenuItem command="showBackendLog" icon="bx bx-receipt" text={t("global_menu.show_backend_log")} />
            <KeyboardActionMenuItem command="showSQLConsole" icon="bx bx-data" text={t("global_menu.open_sql_console")} />
            <MenuItem command="showSQLConsoleHistory" icon="bx bx-data" text={t("global_menu.open_sql_console_history")} />
            <FormDropdownDivider />

            {isElectron() && <MenuItem command="openDevTools" icon="bx bx-bug-alt" text={t("global_menu.open_dev_tools")} />}
            <KeyboardActionMenuItem command="reloadFrontendApp" icon="bx bx-refresh" text={t("global_menu.reload_frontend")} title={t("global_menu.reload_hint")} />

            {isMobile() && <>
                <FormDropdownDivider />
                <SwitchToOptions />
            </>}
        </FormDropdownSubmenu>
    );
}

function BrowserOnlyOptions() {
    return <>
        <FormDropdownDivider />
        <MenuItem command="logout" icon="bx bx-log-out" text={t("global_menu.logout")} />
    </>;
}

function SwitchToOptions() {
    if (isElectron()) {
        return;
    } else if (!isMobile()) {
        return <MenuItem command="switchToMobileVersion" icon="bx bx-mobile" text={t("global_menu.switch_to_mobile_version")} />;
    }
    return <MenuItem command="switchToDesktopVersion" icon="bx bx-desktop" text={t("global_menu.switch_to_desktop_version")} />;

}

function MenuItem({ icon, text, title, command, disabled, active, keyboardShortcut }: MenuItemProps<KeyboardActionNames | CommandNames | (() => void)>) {
    const parentComponent = useContext(ParentComponent);
    return <FormListItem
        icon={icon}
        title={title}
        keyboardShortcut={keyboardShortcut}
        onClick={typeof command === "function" ? command : () => void parentComponent?.triggerCommand(command)}
        disabled={disabled}
        active={active}
    >{text}</FormListItem>;
}

function KeyboardActionMenuItem({ command, ...props }: MenuItemProps<KeyboardActionNames>) {
    return <MenuItem {...props} command={command} keyboardShortcut={command} />;
}

function VerticalLayoutIcon({ logoRef }: { logoRef?: RefObject<SVGSVGElement | null> }) {
    return (
        <svg ref={logoRef} viewBox="20 20 160 160" title={t("global_menu.menu")}>
            <g className="helium-mark" fill="none" stroke-linecap="round">
                <path transform="rotate(-40 100 100)" stroke-width="5" d="M156.57 120.01A60 60 0 0 1 43.43 120.01M43.43 79.99A60 60 0 0 1 156.57 79.99" />
                <circle cx="145.96" cy="61.43" r="13" stroke-width="5" />
                <path stroke-width="4" d="M138.81 61.43H153.11" />
                <circle cx="54.04" cy="138.57" r="13" stroke-width="5" />
                <path stroke-width="4" d="M46.89 138.57H61.19" />
                <circle cx="100" cy="81.52" r="16" stroke-width="5" />
                <path stroke-width="4" d="M91.68 81.52H108.32M100 73.2V89.84" />
                <circle cx="84" cy="109.24" r="16" stroke-width="5" />
                <path stroke-width="4" d="M75.68 109.24H92.32M84 100.92V117.56" />
                <circle className="helium-mark-core" cx="116" cy="109.24" r="16" stroke-width="5" />
            </g>
        </svg>
    );
}

function ZoomControls({ parentComponent }: { parentComponent?: Component | null }) {
    const [ zoomLevel ] = useTriliumOption("zoomFactor");

    function ZoomControlButton({ command, title, icon, children, dismiss }: { command: KeyboardActionNames, title: string, icon?: string, children?: ComponentChildren, dismiss?: boolean }) {
        const linkRef = useRef<HTMLAnchorElement>(null);
        useStaticTooltipWithKeyboardShortcut(linkRef, title, command, {
            placement: "bottom",
            fallbackPlacements: [ "bottom" ]
        });
        return (
            <a
                ref={linkRef}
                tabIndex={0}
                onClick={(e) => {
                    parentComponent?.triggerCommand(command);
                    if (!dismiss) {
                        e.stopPropagation();
                    }
                }}
                className={`dropdown-item-button ${icon}`}
            >{children}</a>
        );
    }

    return isElectron() ? (
        <FormListItem
            icon="bx bx-empty"
            container
            className="zoom-container"
            onClick={(e) => e.stopPropagation()}
        >
            {t("global_menu.zoom")}
            <>
                <div className="zoom-buttons">
                    <ZoomControlButton command="toggleFullscreen" title={t("global_menu.toggle_fullscreen")} icon="bx bx-expand-alt" dismiss />
                    &nbsp;
                    <ZoomControlButton command="zoomOut" title={t("global_menu.zoom_out")} icon="bx bx-minus" />
                    <ZoomControlButton command="zoomReset" title={t("global_menu.reset_zoom_level")}>{(parseFloat(zoomLevel) * 100).toFixed(0)}{t("units.percentage")}</ZoomControlButton>
                    <ZoomControlButton command="zoomIn" title={t("global_menu.zoom_in")} icon="bx bx-plus" />
                </div>
            </>
        </FormListItem>
    ) : (
        <MenuItem icon="bx bx-expand-alt" command="toggleFullscreen" text={t("global_menu.toggle_fullscreen")} />
    );
}

/** Sets menu items side by side, one per column, as the mobile note menu sets backlinks and note paths. */
function MenuItemColumns({ children }: { children: ComponentChildren[] }) {
    return (
        <div className="form-list-row">
            {children.map((child, index) => <div key={index} className="form-list-col">{child}</div>)}
        </div>
    );
}

function ToggleWindowOnTop() {
    const api = window.electronApi?.window;
    const [ isOnTop, setIsOnTop ] = useState(() => api?.isAlwaysOnTop() ?? false);

    return (api &&
        <MenuItem
            icon="bx bx-pin"
            text={t("title_bar_buttons.window-on-top")}
            active={isOnTop}
            command={() => {
                const newState = !isOnTop;
                api.setAlwaysOnTop(newState);
                setIsOnTop(newState);
            }}
        />
    );
}

/** GitHub's "latest release" endpoint, which already excludes drafts and pre-releases. */
export const RELEASES_API_URL = "https://api.github.com/repos/TriliumNext/Trilium/releases/latest";

/** How often to re-check for a newer release, in milliseconds. */
export const UPDATE_CHECK_INTERVAL = 8 * 60 * 60 * 1000;

/**
 * Watches GitHub for a release newer than the version this client is running, so the menu can show
 * the update badge and a download link.
 *
 * Standalone is left out: it is served from the web and picks up new versions on reload, so there is
 * no release for the user to go and download. Every other client — desktop and server alike — is
 * updated by hand and wants the hint.
 */
export function useTriliumUpdateStatus() {
    const [ latestVersion, setLatestVersion ] = useState<string>();
    const [ checkForUpdates ] = useTriliumOptionBool("checkForUpdates");
    const isUpdateAvailable = utils.isUpdateAvailable(latestVersion, window.glob.triliumVersion);

    useEffect(() => {
        if (!checkForUpdates || isStandalone) {
            setLatestVersion(undefined);
            return;
        }

        // A request still in flight when the option is switched off (or the menu unmounts) must not
        // resurrect the version afterwards, so ignore whatever it resolves to.
        let cancelled = false;

        async function updateVersionStatus() {
            let latestVersion: string | undefined;
            try {
                const resp = await fetch(RELEASES_API_URL);
                const data = await resp.json();
                latestVersion = parseLatestVersion(data);
            } catch (e) {
                console.warn("Unable to fetch latest version info from GitHub releases API", e);
            }

            if (!cancelled) {
                setLatestVersion(latestVersion);
            }
        }

        void updateVersionStatus();

        const interval = setInterval(() => void updateVersionStatus(), UPDATE_CHECK_INTERVAL);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [ checkForUpdates ]);

    return { isUpdateAvailable, latestVersion };
}

/** Reads the version off a GitHub release payload, stripping the tag prefix (`v0.104.1` → `0.104.1`). */
export function parseLatestVersion(payload: unknown): string | undefined {
    const tagName = (payload as { tag_name?: unknown } | null | undefined)?.tag_name;
    return typeof tagName === "string" ? tagName.replace(/^v/, "") : undefined;
}
