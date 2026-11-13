import "./HomeBoard.css";

import {
    BOARD_COLUMNS, BOARD_DEFAULT_ROWS, BOARD_MAX_ROWS, boardBottom, boardReadingOrder, type BoardRect, type BoardSize,
    type BoardWidget, defaultBoard, findFreeRect, fitAt, HELIUM_HOME_CONFIG_NOTE_ID, type HomeBoard as HomeBoardModel,
    type HomeData, rectFits
} from "@triliumnext/commons";
import type { CSSProperties, TargetedKeyboardEvent, TargetedPointerEvent } from "preact";
import { Suspense } from "preact/compat";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import contextMenu from "../../../menus/context_menu";
import dialog from "../../../services/dialog";
import { t } from "../../../services/i18n";
import server from "../../../services/server";
import toast from "../../../services/toast";
import { isMobile, randomString } from "../../../services/utils";
import ActionButton from "../../react/ActionButton";
import Button from "../../react/Button";
import { DropdownPanel } from "../../react/Dropdown";
import { useTriliumEvent } from "../../react/hooks";
import Icon from "../../react/Icon";
import LoadingSpinner from "../../react/LoadingSpinner";
import NoItems from "../../react/NoItems";
import { useFetch } from "../../react/use_fetch";
import { getLazyWidget, getWidgetType, HOME_WIDGET_TYPES, HomeDataContext, type HomeWidgetType } from "./registry";

/** The pane width below which the board shows its widgets in one column, without editing. */
const NARROW_WIDTH = 700;
const MIN_ROW_HEIGHT = 40;
/** Must match `--board-gap` and `--board-padding` in `HomeBoard.css`. */
const GAP = 8;
const PADDING = 8;
const FALLBACK_MIN_SIZE: BoardSize = { w: 1, h: 1 };

/** The Home board: widgets on a twelve-column grid, laid out in edit mode and stored in the Home configuration. */
export default function HomeBoard() {
    const { board, save } = useStoredBoard();
    const homeData = useHomeData();
    const [ editing, setEditing ] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const size = useElementSize(scrollRef);
    const narrow = isMobile() || (size.width > 0 && size.width < NARROW_WIDTH);

    return (
        <HomeDataContext.Provider value={homeData}>
            <div className={`helium-board ${editing && !narrow ? "editing" : ""}`}>
                {!narrow && board && (
                    <BoardToolbar
                        board={board} editing={editing} setEditing={setEditing} save={save}
                    />
                )}
                <div className="helium-board-scroll" ref={scrollRef}>
                    {!board ? <LoadingSpinner /> : narrow ? (
                        <div className="helium-board-stack">
                            {boardReadingOrder(board.widgets).map((widget) => (
                                <WidgetPanel key={widget.id} widget={widget} board={board} save={save} editing={false} />
                            ))}
                        </div>
                    ) : (
                        <BoardGrid board={board} save={save} editing={editing} height={size.height} />
                    )}
                </div>
            </div>
        </HomeDataContext.Provider>
    );
}

type SaveBoard = (board: HomeBoardModel) => void;

function BoardToolbar({ board, editing, setEditing, save }: {
    board: HomeBoardModel; editing: boolean; setEditing(editing: boolean): void; save: SaveBoard;
}) {
    if (!editing) {
        return (
            <div className="helium-board-toolbar">
                <Button size="small" kind="lowProfile" icon="bx bx-customize" text={t("helium_home.edit_layout")} onClick={() => setEditing(true)} />
            </div>
        );
    }

    return (
        <div className="helium-board-toolbar">
            <span className="helium-board-hint">{t("helium_home.edit_hint")}</span>
            {board.parked.length > 0 && (
                <div className="helium-board-drawer" role="group" aria-label={t("helium_home.drawer")}>
                    <span>{t("helium_home.drawer")}</span>
                    {board.parked.map((widget) => (
                        <Button
                            key={widget.id} size="small" icon={getWidgetType(widget.type)?.icon ?? "bx bx-question-mark"}
                            text={widgetTitle(widget)} title={t("helium_home.restore_widget")}
                            onClick={() => restoreParked(board, widget, save)}
                        />
                    ))}
                </div>
            )}
            <Button size="small" kind="lowProfile" icon="bx bx-reset" text={t("helium_home.reset_layout")} onClick={async () => {
                if (await dialog.confirm(t("helium_home.reset_layout_confirm"))) save(defaultBoard());
            }} />
            <Button size="small" kind="primary" icon="bx bx-lock-alt" text={t("helium_home.lock_layout")} onClick={() => setEditing(false)} />
        </div>
    );
}

interface DragState {
    id: string;
    mode: "move" | "resize";
    /** The cell of the widget under the pointer when the drag began, relative to its top-left corner. */
    grab: { x: number; y: number };
    rect: BoardRect;
}

function BoardGrid({ board, save, editing, height }: { board: HomeBoardModel; save: SaveBoard; editing: boolean; height: number }) {
    const gridRef = useRef<HTMLDivElement>(null);
    const [ drag, setDrag ] = useState<DragState | null>(null);
    const rows = Math.min(BOARD_MAX_ROWS, Math.max(BOARD_DEFAULT_ROWS, boardBottom(board.widgets) + (editing ? 2 : 0)));
    const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.floor((height - 2 * PADDING - (BOARD_DEFAULT_ROWS - 1) * GAP) / BOARD_DEFAULT_ROWS));

    function cellAt(e: PointerEvent) {
        const bounds = gridRef.current?.getBoundingClientRect();
        if (!bounds) return { x: 0, y: 0 };
        const colPitch = (bounds.width + GAP) / BOARD_COLUMNS;
        return {
            x: clamp(Math.floor((e.clientX - bounds.left) / colPitch), 0, BOARD_COLUMNS - 1),
            y: clamp(Math.floor((e.clientY - bounds.top) / (rowHeight + GAP)), 0, BOARD_MAX_ROWS - 1)
        };
    }

    function startDrag(e: TargetedPointerEvent<HTMLElement>, widget: BoardWidget, mode: DragState["mode"]) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const cell = cellAt(e);
        setDrag({ id: widget.id, mode, grab: { x: cell.x - widget.x, y: cell.y - widget.y }, rect: rectOf(widget) });
    }

    function moveDrag(e: PointerEvent, widget: BoardWidget) {
        if (!drag || drag.id !== widget.id) return;
        const cell = cellAt(e);
        const rect = drag.mode === "move"
            ? movedRect(widget, cell.x - drag.grab.x, cell.y - drag.grab.y)
            : resizedRect(widget, cell.x - widget.x + 1, cell.y - widget.y + 1, minSizeOf(widget));
        if (!sameRect(rect, drag.rect)) setDrag({ ...drag, rect });
    }

    function endDrag(widget: BoardWidget) {
        if (!drag || drag.id !== widget.id) return;
        setDrag(null);
        if (!sameRect(drag.rect, widget) && rectFits(board.widgets, drag.rect, widget.id)) {
            save(withRect(board, widget.id, drag.rect));
        }
    }

    const dragProps = (widget: BoardWidget, mode: DragState["mode"]) => ({
        onPointerDown: (e: TargetedPointerEvent<HTMLElement>) => startDrag(e, widget, mode),
        onPointerMove: (e: PointerEvent) => moveDrag(e, widget),
        onPointerUp: () => endDrag(widget),
        onPointerCancel: () => setDrag(null)
    });

    const style = { "--board-rows": rows, "--board-row-height": `${rowHeight}px` } as CSSProperties;

    return (
        <div className="helium-board-grid" ref={gridRef} style={style}>
            {editing && emptyCells(board.widgets, rows).map((cell) => (
                <button
                    key={`${cell.x}-${cell.y}`} type="button" className="helium-board-cell"
                    style={placement({ ...cell, w: 1, h: 1 })}
                    aria-label={t("helium_home.add_widget_at", { column: cell.x + 1, row: cell.y + 1 })}
                    onClick={(e) => openPicker(e, board, cell, save)}
                >
                    <Icon icon="bx bx-plus" />
                </button>
            ))}
            {drag && (
                <div
                    className={`helium-board-preview ${rectFits(board.widgets, drag.rect, drag.id) ? "" : "blocked"}`}
                    style={placement(drag.rect)}
                />
            )}
            {board.widgets.map((widget) => (
                <WidgetPanel
                    key={widget.id} widget={widget} board={board} save={save} editing={editing}
                    style={placement(widget)}
                    moveHandle={editing ? dragProps(widget, "move") : undefined}
                    resizeHandle={editing ? dragProps(widget, "resize") : undefined}
                />
            ))}
        </div>
    );
}

interface HandleProps {
    onPointerDown(e: TargetedPointerEvent<HTMLElement>): void;
    onPointerMove(e: PointerEvent): void;
    onPointerUp(): void;
    onPointerCancel(): void;
}

function WidgetPanel({ widget, board, save, editing, style, moveHandle, resizeHandle }: {
    widget: BoardWidget;
    board: HomeBoardModel;
    save: SaveBoard;
    editing: boolean;
    style?: CSSProperties;
    moveHandle?: HandleProps;
    resizeHandle?: HandleProps;
}) {
    const type = getWidgetType(widget.type);
    const title = widgetTitle(widget);
    const updateSettings = (settings: Record<string, string>) => save(withSettings(board, widget.id, settings));
    const park = () => save(parkWidget(board, widget.id));

    function onKeyDown(e: TargetedKeyboardEvent<HTMLElement>) {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            park();
            return;
        }
        const rect = keyboardRect(widget, e.key, e.shiftKey, minSizeOf(widget));
        if (!rect) return;
        e.preventDefault();
        if (rectFits(board.widgets, rect, widget.id)) save(withRect(board, widget.id, rect));
    }

    return (
        <section
            className={`helium-board-panel helium-widget-${widget.type}`}
            style={style}
            tabIndex={editing ? 0 : undefined}
            aria-label={editing
                ? t("helium_home.panel_position", { title, column: widget.x + 1, row: widget.y + 1, width: widget.w, height: widget.h })
                : title}
            onKeyDown={editing ? onKeyDown : undefined}
        >
            <header className="helium-board-panel-header" {...moveHandle}>
                <Icon icon={type?.icon ?? "bx bx-question-mark"} />
                <h3>{title}</h3>
                {editing && type?.hasSettings && (
                    <DropdownPanel
                        className="helium-board-settings"
                        dropdownContainerClassName="helium-board-settings-panel"
                        buttonProps={{ onPointerDown: (e) => e.stopPropagation() }}
                        iconAction hideToggleArrow title={t("helium_home.widget_settings")}
                        text={<Icon icon="bx bx-cog" />}
                        autoClose="outside"
                    >
                        <Suspense fallback={<LoadingSpinner />}>
                            <LazySettings type={type} widget={widget} updateSettings={updateSettings} />
                        </Suspense>
                    </DropdownPanel>
                )}
                {editing && (
                    <ActionButton
                        icon="bx bx-x" text={t("helium_home.park_widget")}
                        onPointerDown={(e) => e.stopPropagation()} onClick={park}
                    />
                )}
            </header>
            <div className="helium-board-panel-body">
                {type ? (
                    <Suspense fallback={<LoadingSpinner />}>
                        <LazyBody type={type} widget={widget} updateSettings={updateSettings} />
                    </Suspense>
                ) : (
                    <NoItems icon="bx bx-question-mark" text={t("helium_home.unknown_widget")} size="small" />
                )}
            </div>
            {resizeHandle && (
                <span className="helium-board-resize" aria-hidden="true" {...resizeHandle} />
            )}
        </section>
    );
}

function LazyBody({ type, ...props }: { type: HomeWidgetType; widget: BoardWidget; updateSettings(settings: Record<string, string>): void }) {
    const { Body } = getLazyWidget(type);
    return <Body {...props} />;
}

function LazySettings({ type, ...props }: { type: HomeWidgetType; widget: BoardWidget; updateSettings(settings: Record<string, string>): void }) {
    const { Settings } = getLazyWidget(type);
    return <Settings {...props} />;
}

function openPicker(e: MouseEvent, board: HomeBoardModel, cell: { x: number; y: number }, save: SaveBoard) {
    const place = (widget: BoardWidget, size: BoardSize, fromDrawer: boolean) => {
        const rect = fitAt(board.widgets, cell.x, cell.y, size, minSizeOf(widget));
        if (!rect) {
            toast.showError(t("helium_home.no_room"));
            return;
        }
        save({
            widgets: [ ...board.widgets, { ...widget, ...rect } ],
            parked: fromDrawer ? board.parked.filter((parked) => parked.id !== widget.id) : board.parked
        });
    };

    void contextMenu.show({
        x: e.pageX,
        y: e.pageY,
        items: [
            { kind: "header", title: t("helium_home.add_widget") },
            ...HOME_WIDGET_TYPES.map((type) => ({
                title: type.title(),
                uiIcon: type.icon,
                handler: () => place(newWidget(type), type.defaultSize, false)
            })),
            ...(board.parked.length ? [
                { kind: "header" as const, title: t("helium_home.drawer") },
                ...board.parked.map((widget) => ({
                    title: widgetTitle(widget),
                    uiIcon: getWidgetType(widget.type)?.icon ?? "bx bx-question-mark",
                    handler: () => place(widget, widget, true)
                }))
            ] : [])
        ],
        selectMenuItemHandler: () => {}
    });
}

function restoreParked(board: HomeBoardModel, widget: BoardWidget, save: SaveBoard) {
    const rect = findFreeRect(board.widgets, widget, minSizeOf(widget));
    if (!rect) {
        toast.showError(t("helium_home.no_room"));
        return;
    }
    save({
        widgets: [ ...board.widgets, { ...widget, ...rect } ],
        parked: board.parked.filter((parked) => parked.id !== widget.id)
    });
}

/**
 * The board stored in the Home configuration. Changes show at once and are saved one after another;
 * a reload from the server (another device's change) applies only while no save of this window is
 * in flight, so it cannot undo a newer local change.
 */
function useStoredBoard() {
    const [ refreshToken, setRefreshToken ] = useState(0);
    const { data } = useFetch<HomeBoardModel>("helium/home/board", refreshToken);
    const [ board, setBoard ] = useState<HomeBoardModel | null>(null);
    const pendingSaves = useRef(0);
    const queue = useRef<Promise<unknown>>(Promise.resolve());

    useEffect(() => {
        if (data && pendingSaves.current === 0) setBoard(data);
    }, [ data ]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (loadResults.isNoteContentReloaded(HELIUM_HOME_CONFIG_NOTE_ID)) setRefreshToken((token) => token + 1);
    });

    function save(next: HomeBoardModel) {
        setBoard(next);
        pendingSaves.current++;
        queue.current = queue.current
            .then(() => server.put("helium/home/board", { board: next }))
            .catch(() => setRefreshToken((token) => token + 1))
            .finally(() => { pendingSaves.current--; });
    }

    return { board, save };
}

/** Recent, Pinned and Inbox, fetched once for the whole board and again on any tree change. */
function useHomeData() {
    const [ refreshToken, setRefreshToken ] = useState(0);
    const state = useFetch<HomeData>("helium/home", refreshToken);
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!loadResults.isEmptyForTree()) setRefreshToken((token) => token + 1);
    });
    return state;
}

function useElementSize(ref: { current: HTMLElement | null }) {
    const [ size, setSize ] = useState({ width: 0, height: 0 });
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
        observer.observe(element);
        return () => observer.disconnect();
    }, [ ref ]);
    return size;
}

function widgetTitle(widget: BoardWidget) {
    return getWidgetType(widget.type)?.title() ?? t("helium_home.unknown_widget");
}

function minSizeOf(widget: BoardWidget) {
    return getWidgetType(widget.type)?.minSize ?? FALLBACK_MIN_SIZE;
}

function newWidget(type: HomeWidgetType): BoardWidget {
    return { id: `${type.id}-${randomString(8)}`, type: type.id, x: 0, y: 0, ...type.defaultSize, settings: {} };
}

function placement(rect: BoardRect): CSSProperties {
    return { gridColumn: `${rect.x + 1} / span ${rect.w}`, gridRow: `${rect.y + 1} / span ${rect.h}` };
}

function rectOf({ x, y, w, h }: BoardRect): BoardRect {
    return { x, y, w, h };
}

function sameRect(a: BoardRect, b: BoardRect) {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

/** The free cells of the visible rows, where edit mode offers to add a widget. */
export function emptyCells(widgets: BoardWidget[], rows: number) {
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < BOARD_COLUMNS; x++) {
            if (rectFits(widgets, { x, y, w: 1, h: 1 })) cells.push({ x, y });
        }
    }
    return cells;
}

/** `widget` moved to (`x`, `y`), kept inside the columns. */
export function movedRect(widget: BoardRect, x: number, y: number): BoardRect {
    return { x: clamp(x, 0, BOARD_COLUMNS - widget.w), y: clamp(y, 0, BOARD_MAX_ROWS - widget.h), w: widget.w, h: widget.h };
}

/** `widget` resized to `w` × `h`, no smaller than `minSize` and inside the columns. */
export function resizedRect(widget: BoardRect, w: number, h: number, minSize: BoardSize): BoardRect {
    return {
        x: widget.x, y: widget.y,
        w: clamp(w, Math.min(minSize.w, BOARD_COLUMNS - widget.x), BOARD_COLUMNS - widget.x),
        h: clamp(h, minSize.h, BOARD_MAX_ROWS - widget.y)
    };
}

/** Where an arrow key takes a focused panel: it moves the panel, or with Shift resizes it. `null` for other keys. */
export function keyboardRect(widget: BoardRect, key: string, shift: boolean, minSize: BoardSize): BoardRect | null {
    const delta = ({ ArrowLeft: [ -1, 0 ], ArrowRight: [ 1, 0 ], ArrowUp: [ 0, -1 ], ArrowDown: [ 0, 1 ] } as Record<string, [number, number]>)[key];
    if (!delta) return null;
    const [ dx, dy ] = delta;
    return shift
        ? resizedRect(widget, widget.w + dx, widget.h + dy, minSize)
        : movedRect(widget, widget.x + dx, widget.y + dy);
}

export function withRect(board: HomeBoardModel, id: string, rect: BoardRect): HomeBoardModel {
    return { ...board, widgets: board.widgets.map((widget) => widget.id === id ? { ...widget, ...rect } : widget) };
}

export function withSettings(board: HomeBoardModel, id: string, settings: Record<string, string>): HomeBoardModel {
    const update = (widget: BoardWidget) => widget.id === id ? { ...widget, settings } : widget;
    return { widgets: board.widgets.map(update), parked: board.parked.map(update) };
}

/** Moves a widget into the drawer, keeping its settings and size. */
export function parkWidget(board: HomeBoardModel, id: string): HomeBoardModel {
    const widget = board.widgets.find((candidate) => candidate.id === id);
    if (!widget) return board;
    return { widgets: board.widgets.filter((candidate) => candidate.id !== id), parked: [ ...board.parked, widget ] };
}
