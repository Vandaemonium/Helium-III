# Quick Notes tab
The Quick Notes tab captures short text notes beside whatever note is open, and lists the notes captured so far as cards. It is available for every note, whatever its type, and does not depend on the <a class="reference-link" href="../../../AI.md">AI</a> integration.

## Capturing a note

*   To capture a note, type into the composer at the top of the tab and press _Save note_. The first line that is not blank becomes the note's title, and the whole text becomes its content. Text that looks like HTML is saved as plain text.
*   Nothing is saved until _Save note_ is pressed. A blank composer is refused.
*   The draft is shared with the _Quick Notes_ widget on <a class="reference-link" href="../Home.md">Home</a>, so text typed in one appears in the other.
*   The draft stays while switching tabs, closing the right sidebar or moving to another note, but only for as long as the window stays open. Closing or reloading the window with an unsaved draft asks for confirmation first.
*   If saving fails, the draft is kept and can be saved again. If the connection drops before the answer arrives, the note might have been created anyway: the tab says the save is uncertain and only allows saving again after pressing _I checked; allow retry_, so that a note is not created twice.

Captured notes are ordinary text notes, created in the _Quick Notes_ folder at the top of the <a class="reference-link" href="../Note%20Tree.md">Note Tree</a>. They can be edited, moved, cloned or deleted like any other note.

## Cards

Each direct text child of the _Quick Notes_ folder is shown as a card: its title, and below it one line of its text, which leaves out a first line that only repeats the title. The <span class="tn-icon bx bx-pin"></span> pin and <span class="tn-icon bx bx-archive-in"></span> archive buttons appear at the end of the card while the pointer is over it or it has the focus, and always on a touch screen.

*   To open a note in the current tab, press its card.
*   To keep a card at the top, press <span class="tn-icon bx bx-pin"></span> _Pin_; on a pinned card the filled <span class="tn-icon bx bxs-pin"></span> _Unpin_ button stays visible and releases it. Pinned cards have a colored border and come first, then the most recently modified.
*   To put a card away without deleting it, press <span class="tn-icon bx bx-archive-in"></span> _Archive_. Archived cards are listed under _Archived_ instead of _Active_, and <span class="tn-icon bx bx-archive-out"></span> _Restore_ brings them back.
*   To find a card, type into the search field. The search matches the title and the text of the cards in the selected view only.

Pinning and archiving set the `#heliumQuickPinned` and `#heliumQuickArchived` labels on the note. They do not change the `#pinned` or `#archived` labels used elsewhere, such as on <a class="reference-link" href="../Home.md">Home</a>.

## Protected notes

Quick Notes never shows or changes [protected notes](../../Notes/Protected%20Notes.md), even while the protected session is open. If the _Quick Notes_ folder itself is protected, saving is refused rather than creating the note somewhere else.

## Setup and the Quick Notes folder

The _Quick Notes_ folder is created the first time Trilium starts with this feature. Its configuration is kept in the hidden notes, under _Helium Features_. Hidden notes are not encrypted.

*   The folder can be renamed or moved within the tree; Quick Notes finds it by its identity, not by its name.
*   If the folder is deleted, the tab says so and saving stops. Restore it from <a class="reference-link" href="../Recent%20Changes.md">Recent Changes</a>.
*   If a top-level note named “Quick Notes” already exists when Trilium sets the feature up, no folder is created. Rename the existing note, then press _Set up again_ in the tab.

## Turning it off

To hide the tab, turn off _Quick Notes tab_ in <a class="reference-link" href="../Options.md">Options</a> → _Other_ → _Home and Quick Notes_. The captured notes stay where they are.

## Mobile support

On mobile, the tab is part of the note panel, opened from the <span class="tn-icon bx bx-dock-bottom"></span> button. Closing the panel keeps the draft, and pressing a card's title closes the panel and opens the note.