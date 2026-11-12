import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('package builds reproducibly and contains only inert owned executable assets', async () => {
    const url = new URL('../scripts/build-package.mjs', import.meta.url);
    assert.ok(fs.existsSync(url), 'versioned inert package builder must exist');
    const { buildPackage } = await import(url.href);
    const a = buildPackage(), b = buildPackage();
    assert.ok(a.zipBuffer.equals(b.zipBuffer));
    assert.equal(a.metaFile.heliumModuleManifest.moduleId, 'empyrean.quick-notes');
    assert.equal(a.metaFile.files.length, 1);
    const walk = node => [node, ...(node.children || []).flatMap(walk)];
    const notes = a.metaFile.files.flatMap(walk);
    assert.equal(notes.length, 6);
    for (const node of notes) {
        assert.ok(node.attributes.some(a => a.name === 'heliumModuleId' && a.value === 'empyrean.quick-notes'));
        assert.ok(!node.attributes.some(a => ['renderNote','run','widget','appCss','appTheme','customRequestHandler'].includes(a.name)));
    }
    assert.ok(!a.entries.some(e => /config|userdata/i.test(e.name)));
    const checkRequires = (node, prefix = '') => {
        const source = a.entries.find(e => e.name === prefix + node.dataFileName).content;
        const directChildren = new Set((node.children || []).map(child => child.title));
        for (const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
            assert.ok(directChildren.has(match[1]), `${node.title} may require only direct child modules: ${match[1]}`);
        }
        for (const child of node.children || []) checkRequires(child, prefix + (node.dirFileName ? node.dirFileName+'/' : ''));
    };
    checkRequires(a.metaFile.files[0]);
});
