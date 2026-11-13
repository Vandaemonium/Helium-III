# Home
Home is the overview shown when the root note is opened: the notes modified most recently, the pinned notes and the inbox. It takes the place of the root note's own content and its list of child notes; the root note itself is not changed.

## Sections

*   _Recent_ lists the most recently modified notes.
*   _Pinned_ lists the notes with the `#pinned` label.
*   _Inbox_ lists the notes with the `#inbox` label, and the direct children of any note with that label, so a whole folder can serve as an inbox.

Each entry is a link that opens the note. The sections update as notes change.

Home leaves out [protected notes](../Notes/Protected%20Notes.md) even while the protected session is open, hidden notes, and notes with the `#archived` label.

## Configuration

The number of entries in each section and the labels used for _Pinned_ and _Inbox_ are kept in the hidden notes, as JSON in _Helium Features_ → _Home Configuration_:

```json
{
    "schemaVersion": 1,
    "recentLimit": 8,
    "pinnedLabel": "pinned",
    "pinnedLimit": 12,
    "inboxLabel": "inbox",
    "inboxLimit": 10,
    "excludeHidden": true,
    "excludeArchived": true
}
```

Limits range from 1 to 50. A value that is missing or invalid falls back to its default, and an edited configuration is kept across restarts.

To show the root note's own content instead, turn off _Home on the root note_ in <a class="reference-link" href="Options.md">Options</a> → _Other_ → _Home and Quick Notes_. The root note's source and attachments stay reachable from the <a class="reference-link" href="Note%20menu.md">Note menu</a> either way.

## See also

*   <a class="reference-link" href="Right%20Sidebar/Quick%20Notes%20tab.md">Quick Notes tab</a>, which captures notes from beside any note.