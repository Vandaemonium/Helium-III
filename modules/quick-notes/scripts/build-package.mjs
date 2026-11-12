import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeterministicZipBuffer } from './zip.mjs';
const dir = fileURLToPath(new URL('..', import.meta.url));
export const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
export function buildPackage() {
    const entries = [];
    function node(role, title, type, mime, dataFileName, content, children = []) {
        const value = { noteId: `helium_quick_${role}`, title, type, mime, dataFileName,
            notePosition: 10, isExpanded: false, isClone: false, attachments: [],
            attributes: [
                { type: 'label', name: 'heliumModuleId', value: manifest.moduleId, isInheritable: false },
                { type: 'label', name: 'heliumModuleRole', value: role, isInheritable: false },
                { type: 'label', name: 'heliumModuleVersion', value: manifest.version, isInheritable: false }
            ], children };
        value._content = content;
        return value;
    }
    const source = name => fs.readFileSync(path.join(dir, 'src', name), 'utf8');
    const children = ['Core','Adapter','View'].map(name => node(name.toLowerCase(), `QuickNotes${name}`, 'code', 'application/javascript;env=frontend', `QuickNotes${name}.js`, source(`QuickNotes${name}.js`)));
    const boot = node('boot', 'QuickNotesBoot', 'code', 'application/javascript;env=frontend', 'QuickNotesBoot.js', source('QuickNotesBoot.js'), children);
    boot.dirFileName = 'QuickNotesBoot';
    const panel = node('panel', 'QuickNotesPanel', 'code', 'text/html', 'QuickNotesPanel.html', '<!-- Quick Notes: explicitly activate the retained Render Note host. -->', [boot]);
    panel.format = 'html'; panel.dirFileName = 'QuickNotesPanel';
    const root = node('root', `${manifest.moduleId} (v${manifest.version})`, 'book', 'text/html', 'empyrean.quick-notes.html', '<p>Owned code only. Keep notes and configuration outside this subtree.</p>', [panel]);
    root.format = 'html'; root.dirFileName = 'empyrean.quick-notes';
    function collect(n, prefix = '', notePath = []) {
        n.notePath = [...notePath, n.noteId];
        entries.push({ name: prefix+n.dataFileName, content: n._content }); delete n._content;
        for (const child of n.children || []) collect(child, prefix+(n.dirFileName ? n.dirFileName+'/' : ''), n.notePath);
    }
    collect(root);
    const metaFile = { formatVersion: 2, appVersion: '0.107.0', heliumModuleManifest: manifest, files: [root] };
    entries.unshift({ name: '!!!meta.json', content: JSON.stringify(metaFile, null, 2) });
    return { zipBuffer: createDeterministicZipBuffer(entries), entries, metaFile };
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    const output = path.join(dir, 'dist', `${manifest.moduleId}-${manifest.version}.zip`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const { zipBuffer } = buildPackage(); fs.writeFileSync(output, zipBuffer);
    console.log(`Built ${output} (${zipBuffer.length} bytes)`);
}
