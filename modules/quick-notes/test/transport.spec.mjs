import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EtapiClient } from '../scripts/lifecycle.mjs';
test('ETAPI note-content writes use raw HTML rather than JSON-string encoding', async () => {
    const original = globalThis.fetch;
    let observed;
    globalThis.fetch = async (_url, options) => { observed = options; return new Response(null, { status: 204 }); };
    try {
        const client = new EtapiClient('http://127.0.0.1:18174', randomBytes(24).toString('hex'));
        await client.request('PUT', 'notes/fixture/content', '<p>native text</p>');
        // apps/server/src/app.ts uses express.text() with its default text/plain matcher.
        assert.equal(observed.headers['Content-Type'], 'text/plain');
        assert.equal(observed.body, '<p>native text</p>');
        assert.equal(observed.redirect, 'error');
    } finally { globalThis.fetch = original; }
});
