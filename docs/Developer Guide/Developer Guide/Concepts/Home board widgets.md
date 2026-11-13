# Home board widgets
The Home board (the root note's view while _Home on the root note_ is on) is a grid of widgets. Each widget type is registered once, in `apps/client/src/widgets/type_widgets/home/registry.ts`; the board, the widget picker, the one-column phone layout and the stored layout all read that registry.

## Where things live

| Piece | File |
| --- | --- |
| Layout model and pure helpers (`rectFits`, `fitAt`, `findFreeRect`, `normalizeBoard`, `defaultBoard`) | `packages/commons/src/lib/helium_board.ts` |
| Stored layout: the `board` key of `_heliumHomeConfig`, read and saved by `GET`/`PUT /api/helium/home/board` | `packages/trilium-core/src/services/helium.ts` |
| Widget registry | `apps/client/src/widgets/type_widgets/home/registry.ts` |
| Board: grid, edit mode, drag and keyboard editing, picker, drawer | `apps/client/src/widgets/type_widgets/home/HomeBoard.tsx` |
| Widgets | `ListWidgets.tsx`, `ClockWidget.tsx`, `HomeCalendar.tsx`, `ChecklistWidget.tsx` in the same folder; Quick Notes reuses `QuickNotesPanel` from `widgets/sidebar/QuickNotes.tsx` |

A stored widget is `{ id, type, x, y, w, h, settings }`: `type` is the registry ID, the rectangle is in whole cells of a 12-column grid, and `settings` maps keys (starting with a letter) to strings of at most 500 characters. The server accepts a layout only if every widget is inside the grid, none overlap and no ID repeats; a stored layout that fails the same check is shown as `defaultBoard()`.

## Adding a widget

1.  Write the component in `apps/client/src/widgets/type_widgets/home/`. It receives `HomeWidgetProps`: the stored `widget` (read its `settings`) and `updateSettings(settings)`, which saves new settings into the board. Put it in an existing module of the same kind (a list of notes goes in `ListWidgets.tsx`) unless it is large enough for its own.
2.  If it has settings, export a `Settings` component from the same module, taking the same props. The board shows it in a panel from the widget's header in edit mode. When the widget is unusable without a setting (a checklist with no note), also render the settings inside the widget's empty state, so the user does not need to unlock the board.
3.  Register it in `HOME_WIDGET_TYPES`:
    
    ```typescript
    {
        id: "weather",
        title: () => t("helium_home.widget_weather"),
        icon: "bx bx-cloud",
        defaultSize: { w: 4, h: 3 },
        minSize: { w: 2, h: 2 },
        hasSettings: true,
        load: () => import("./WeatherWidget")
    }
    ```
    
    `load()` resolves to a module whose `default` is the component and whose optional `Settings` is the settings editor; the board loads it lazily the first time a board shows that type. A module that exports the component under another name maps it: `load: async () => ({ default: (await import("./ListWidgets")).RecentWidget })`.
4.  Add the English strings under `helium_home` in `apps/client/src/translations/en/translation.json`.
5.  To place it on new boards, add it to `defaultBoard()` in `helium_board.ts`; the spec in `HomeBoard.spec.tsx` checks that every default widget is registered and at least its minimum size.
6.  Document it in the User Guide's _Home_ page, under _Widgets_.

## Rules for widgets

*   **Never rename a shipped `id`.** It is stored in every user's layout; a board with an unknown type shows a placeholder the user can only park.
*   **Leave out protected notes, even while the protected session is open**, and render note titles as text (`NoteLink`, never HTML).
*   **Write only on an explicit user action.** A write goes through a core route that validates its input, re-reads what it changes inside the transaction, and refuses a change based on a stale read, as `PUT /api/helium/checklist/:noteId/items/:index` does with the item's text.
*   A widget fills its panel and scrolls inside it; on the phone layout panels take their natural height up to 70% of the viewport. Use the theme's variables (`--card-padding-inline`, `--muted-text-color`, …) rather than fixed colors or spacing, so both densities work.
*   Data several widgets share is fetched once by the board: `HomeDataContext` carries the `helium/home` response that _Recent_, _Pinned_ and _Inbox_ read.