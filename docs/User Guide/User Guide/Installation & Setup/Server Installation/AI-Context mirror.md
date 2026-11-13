# AI-Context mirror
The AI-Context mirror shows a folder of Markdown files as read-only notes, so they sit next to your own notes and appear in search. A server instance mirrors the folder only when the `HELIUM_AI_CONTEXT_DIR` environment variable names it; without the variable, nothing is created.

## Setting it up

To mirror a folder on a Docker installation, mount it read-only into the container and point the variable at the mount:

```yaml
services:
  helium:
    environment:
      - HELIUM_AI_CONTEXT_DIR=/ai-context
    volumes:
      - /home/vc/AI-Context/shared/canonical:/ai-context:ro
```

Then restart the container.

## What it creates

*   A top-level note _AI-Context_, whose text says when the mirror last changed something.
*   One text note under it for each `.md` file directly in the folder. The title is the file's first `#` heading, or its file name. The content is the Markdown converted the same way as a Markdown import, so headings, tables and links render. Front matter is left out.
*   `_index.md` comes first, then the files in the order `_index.md` names them in backticks, then the rest alphabetically.

Every mirrored note carries `#readOnly`, `#disableVersioning` and `#heliumMirror`. The mirror changes only notes that carry `#heliumMirror` under the fixed IDs it creates, never any other note.

## When it updates

The mirror runs at startup, a couple of seconds after a file in the folder changes, and every ten minutes in case a change was missed. A changed file updates its note, a new file adds a note, and a removed file deletes its note. Files that did not change are left alone.

> [!WARNING]
> The folder is the source. An edit made in a mirrored note is overwritten on the next sync.

## Limitations

*   Subfolders, symbolic links, non-Markdown files and files larger than 2 MB are skipped.
*   Links between the Markdown files stay plain links to the file names; they do not become links between notes.
*   If the folder is unreadable or holds no Markdown files, the mirror changes nothing.