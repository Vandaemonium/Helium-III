# Home
Home is the board of widgets shown when the root note is opened: quick capture, a calendar of the journal, a checklist, the clock, recent, pinned and inbox notes, bookmarks and saved searches, each in its own panel. It takes the place of the root note's own content and its list of child notes; the root note itself is not changed.

## The board

The board is a grid of twelve columns. Each widget fills a rectangle of whole cells, and widgets never overlap. The rows are sized so the default layout fills the pane; a taller layout scrolls.

The layout, each widget's settings and the parked widgets are stored in the hidden notes and sync like any other note, so every device shows the same board.

On a phone, or in a pane narrower than about 700 pixels, the widgets are shown in one column, top row first, and the layout cannot be edited there.

## Editing the layout

The board starts locked. To change it, select _Edit layout_ above the board. In edit mode:

*   To move a widget, drag it by its header. A preview shows where it lands; it turns red where the widget would overlap another or leave the grid, and the widget then stays where it was.
*   To resize a widget, drag the handle in its bottom-right corner. Each widget has a minimum size.
*   To add a widget, select an empty cell (a <span class="tn-icon bx bx-plus"></span> appears on hover) and pick a widget from the menu. It is placed at that cell, shrunk to fit the free space if needed.
*   To take a widget off the board, select the <span class="tn-icon bx bx-x"></span> button in its header. The widget is parked, not deleted: it keeps its settings and appears under _Parked_ above the board and in the menu of an empty cell, from where it can be put back.
*   To change a widget's settings, such as the note a checklist shows, select the <span class="tn-icon bx bx-cog"></span> button in its header.
*   To return to the default layout, select _Reset layout..._. Added and parked widgets and their settings are removed from the board; no notes are changed.

Select _Lock layout_ when done.

With the keyboard, press <kbd>Tab</kbd> to focus a widget in edit mode, then:

*   the arrow keys move it by one cell,
*   <kbd>Shift</kbd> with an arrow key resizes it,
*   <kbd>Delete</kbd> parks it.

## Widgets

### Quick Notes

A composer and the cards of the Quick Notes folder, the same as the <a class="reference-link" href="Right%20Sidebar/Quick%20Notes%20tab.md">Quick Notes tab</a>. The draft is shared between the widget and the tab, so text typed in one appears in the other.

### Calendar

A month of the <a class="reference-link" href="../../Advanced%20Usage/Advanced%20Showcases/Day%20Notes.md">Day Notes</a> journal. Days that have a day note are marked. Selecting a day opens its day note, creating it first if it does not exist, as the calendar in the <a class="reference-link" href="Launch%20Bar.md">Launch Bar</a> does.

### Checklist

The to-do items of one text note, which can be ticked from the board. To choose the note, select it in the widget, or in its settings in edit mode. When no note is chosen yet, the widget also offers _Create Checklist note_, which creates a text note named "Checklist" under the root note with one empty to-do item.

Ticking an item changes only that item's checkbox in the note. If the note was edited elsewhere since the widget loaded it and the item has changed, the tick is refused with a message and the widget shows the current list.

Add or rename items in the note itself, with the to-do list button <span class="tn-icon cke cke-todo-list"></span> of the text editor.

### Bookmarks

The notes bookmarked from the <a class="reference-link" href="Note%20menu.md">Note menu</a>, in the order of the <a class="reference-link" href="Launch%20Bar.md">Launch Bar</a>'s bookmarks. Selecting one opens it.

### Clock

The local time and date. To also show the time in another place, set _Second time zone_ in the widget's settings to an IANA time zone such as `Europe/Berlin`.

### Recent, Pinned and Inbox

*   _Recent_ lists the most recently modified notes.
*   _Pinned_ lists the notes that carry the `#pinned` label themselves; a label a note only inherits does not count.
*   _Inbox_ lists the notes that carry the `#inbox` label themselves, and the direct children of any such note, so a whole folder can serve as an inbox.

### Saved search

The results of a <a class="reference-link" href="../../Note%20Types/Saved%20Search.md">Saved Search</a> note, chosen in the widget or in its settings. The results update as notes change.

## What Home shows

Every widget leaves out [protected notes](../Notes/Protected%20Notes.md), even while the protected session is open. _Recent_, _Pinned_ and _Inbox_ also leave out hidden notes and notes with the `#archived` label; a note that is bookmarked or otherwise cloned into the hidden notes is still listed through its other paths. Note titles are shown as text, and each entry is a link that opens the note.

Home changes notes only when asked to: saving a quick note, ticking a checklist item, creating the checklist note, or opening a day that has no day note yet.

## Configuration

The number of entries in _Recent_, _Pinned_ and _Inbox_, the labels used for _Pinned_ and _Inbox_, and the board itself are kept in the hidden notes, as JSON in _Helium Features_ → _Home Configuration_:

```json
{
    "schemaVersion": 2,
    "recentLimit": 8,
    "pinnedLabel": "pinned",
    "pinnedLimit": 12,
    "inboxLabel": "inbox",
    "inboxLimit": 10,
    "excludeHidden": true,
    "excludeArchived": true,
    "board": { "widgets": [ … ], "parked": [] }
}
```

Limits range from 1 to 50. A value that is missing or invalid falls back to its default. A board that is unreadable, or whose widgets overlap or leave the grid, is shown as the default layout without changing the note; the next layout saved from the board replaces it. A configuration from before the board (`"schemaVersion": 1`) keeps its limits and labels and gets the default layout.

To show the root note's own content instead, turn off _Home on the root note_ in <a class="reference-link" href="Options.md">Options</a> → _Other_ → _Home and Quick Notes_. The root note's source and attachments stay reachable from the <a class="reference-link" href="Note%20menu.md">Note menu</a> either way.

## See also

*   <a class="reference-link" href="Right%20Sidebar/Quick%20Notes%20tab.md">Quick Notes tab</a>, which captures notes from beside any note.