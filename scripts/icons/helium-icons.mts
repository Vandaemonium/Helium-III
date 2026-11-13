/**
 * Builds every Helium-III icon from the SVG masters in `apps/server/src/assets/images/helium/`:
 * the app's SVG logos, the favicons, the PWA icon, the desktop app/tray icons (PNG, ICO, ICNS)
 * and the iOS app icon. Renders with the system Chromium through Playwright.
 *
 * Run with: node scripts/icons/helium-icons.mts [path to chromium]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { chromium } from "playwright";

const root = path.join(import.meta.dirname, "../..");
const masters = path.join(root, "apps/server/src/assets/images/helium");
const out = (rel: string) => path.join(root, rel);
const master = (name: string) => readFileSync(path.join(masters, name), "utf8");

const browser = await chromium.launch({ executablePath: process.argv[2] ?? "/usr/bin/chromium" });
const page = await browser.newPage();

/** Renders an SVG to a transparent PNG of `size`×`size` pixels. */
async function render(svg: string, size: number): Promise<Buffer> {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>*{margin:0}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}">`);
    await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** Renders an SVG to an opaque RGB PNG (no alpha channel), as the App Store requires. */
async function renderOpaque(svg: string, size: number, background: string): Promise<Buffer> {
    await render(svg, size);
    const rgba = await page.evaluate(async ({ size, background }) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(document.querySelector("img") as HTMLImageElement, 0, 0, size, size);
        return Array.from(ctx.getImageData(0, 0, size, size).data);
    }, { size, background });
    return encodeRgbPng(rgba, size);
}

const write = (rel: string, data: Buffer | string) => {
    mkdirSync(path.dirname(out(rel)), { recursive: true });
    writeFileSync(out(rel), data);
};

const appIcon = master("icon-default-rounded.svg");
const devIcon = master("icon-night-rounded.svg");

// SVG logos the app references by their old names.
write("apps/server/src/assets/images/icon-color.svg", appIcon);
write("apps/server/src/assets/images/icon-purple.svg", devIcon);
write("apps/server/src/assets/images/icon-installer.svg", master("icon-default-square.svg"));
write("apps/server/src/assets/images/icon-installer-purple.svg", master("icon-night-square.svg"));
write("apps/server/src/assets/images/icon-black.svg", master("mark-black.svg"));
write("apps/server/src/assets/images/icon-white.svg", master("mark-white.svg"));
write("apps/client/src/assets/icon-color.svg", appIcon);
write("apps/client/src/assets/icon.svg", master("mark-starlight.svg"));
write("apps/client/src/assets/icon-nightly.svg", master("mark-violet.svg"));
write("apps/edit-docs/demo/root/Trilium Demo_icon-color.svg", appIcon);

// PNGs.
for (const [ rel, svg, size ] of [
    [ "apps/client/src/assets/icon.png", appIcon, 512 ],
    [ "apps/web-clipper/assets/icon.png", appIcon, 512 ],
    [ "apps/desktop/electron-forge/app-icon/ios/apple-touch-icon.png", master("icon-default-square.svg"), 180 ],
    [ "apps/desktop/electron-forge/app-icon/png/1000x1000.png", appIcon, 1000 ],
    ...[ 16, 32, 128, 256, 512, 1024 ].flatMap((size) => [
        [ `apps/desktop/electron-forge/app-icon/png/${size}x${size}.png`, appIcon, size ],
        [ `apps/desktop/electron-forge/app-icon/png/${size}x${size}-dev.png`, devIcon, size ]
    ]),
    ...([ [ "", 16 ], [ "@1.25x", 20 ], [ "@1.5x", 24 ], [ "@2x", 32 ] ] as const).flatMap(([ suffix, size ]) => [
        [ `apps/desktop/src/assets/images/tray/icon-color${suffix}.png`, master("mark-starlight.svg"), size ],
        [ `apps/desktop/src/assets/images/tray/icon-purple${suffix}.png`, master("mark-violet.svg"), size ],
        [ `apps/desktop/src/assets/images/tray/icon-blackTemplate${suffix}.png`, master("mark-black.svg"), size ]
    ])
] as [ string, string, number ][]) {
    write(rel, await render(svg, size));
}
write("apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    await renderOpaque(master("icon-default-square.svg"), 1024, "#1a1922"));

// Favicons and Windows icons.
const icoSizes = [ 16, 32, 48, 64, 128, 256 ];
const appIco = buildIco(await Promise.all(icoSizes.map((size) => render(appIcon, size))), icoSizes);
const devIco = buildIco(await Promise.all(icoSizes.map((size) => render(devIcon, size))), icoSizes);
for (const rel of [ "apps/server/src/assets/icon.ico", "apps/desktop/electron-forge/app-icon/icon.ico", "apps/standalone/public/favicon.ico" ]) {
    write(rel, appIco);
}
write("apps/server/src/assets/icon-dev.ico", devIco);
write("apps/desktop/electron-forge/app-icon/icon-dev.ico", devIco);
const setupIco = (svg: string) => Promise.all(icoSizes.map((size) => render(svg, size))).then((pngs) => buildIco(pngs, icoSizes));
write("apps/desktop/electron-forge/setup-icon/setup.ico", await setupIco(master("icon-default-square.svg")));
write("apps/desktop/electron-forge/setup-icon/setup-dev.ico", await setupIco(master("icon-night-square.svg")));

// macOS icons.
const icnsSlots: [ string, number ][] = [ [ "ic11", 32 ], [ "ic12", 64 ], [ "ic07", 128 ], [ "ic13", 256 ], [ "ic08", 256 ], [ "ic09", 512 ], [ "ic10", 1024 ] ];
write("apps/desktop/electron-forge/app-icon/icon.icns", buildIcns(await Promise.all(icnsSlots.map(async ([ type, size ]) => [ type, await render(appIcon, size) ] as const))));
write("apps/desktop/electron-forge/app-icon/icon-dev.icns", buildIcns(await Promise.all(icnsSlots.map(async ([ type, size ]) => [ type, await render(devIcon, size) ] as const))));

await browser.close();

/** Packs PNGs into a `.ico` (PNG-compressed entries, read by Windows Vista and later and every browser). */
function buildIco(pngs: Buffer[], sizes: number[]) {
    const header = Buffer.alloc(6 + 16 * pngs.length);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    let offset = header.length;
    for (const [ i, png ] of pngs.entries()) {
        const entry = 6 + 16 * i;
        header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], entry);
        header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], entry + 1);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(png.length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    }
    return Buffer.concat([ header, ...pngs ]);
}

/** Packs PNGs into a `.icns`, each chunk named by the OSType that marks it as PNG data. */
function buildIcns(chunks: (readonly [ string, Buffer ])[]) {
    const parts = chunks.map(([ type, png ]) => {
        const head = Buffer.alloc(8);
        head.write(type, 0, "ascii");
        head.writeUInt32BE(png.length + 8, 4);
        return Buffer.concat([ head, png ]);
    });
    const head = Buffer.alloc(8);
    head.write("icns", 0, "ascii");
    head.writeUInt32BE(8 + parts.reduce((sum, part) => sum + part.length, 0), 4);
    return Buffer.concat([ head, ...parts ]);
}

/** Encodes RGBA pixels as an 8-bit RGB PNG, dropping the alpha channel. */
function encodeRgbPng(rgba: number[], size: number) {
    const raw = Buffer.alloc((size * 3 + 1) * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            for (let c = 0; c < 3; c++) raw[y * (size * 3 + 1) + 1 + x * 3 + c] = rgba[(y * size + x) * 4 + c];
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ]),
        pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))
    ]);
}

function pngChunk(type: string, data: Buffer) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([ Buffer.from(type, "ascii"), data ]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([ length, body, crc ]);
}

function crc32(buf: Buffer) {
    let crc = ~0;
    for (const byte of buf) {
        crc ^= byte;
        for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return ~crc >>> 0;
}
