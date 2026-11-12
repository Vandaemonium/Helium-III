#!/usr/bin/env node
/**
 * Builds the importable Helium-III / Trilium note-subtree ZIP package for `empyrean.home-panel`.
 * The generated archive contains ONLY owned executable code notes (`!!!meta.json` + code files).
 * User configuration and user notes are never bundled inside the code package so upgrades/uninstalls
 * never overwrite or delete user state.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.resolve(__dirname, "..");

/**
 * Minimal pure-Node ZIP writer (store / deflate) so packaging works without external native binaries.
 */
function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export function createDeterministicZipBuffer(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    // Fixed DOS timestamp (2026-11-12 00:00:00) for reproducible builds
    const dosTime = 0x0000;
    const dosDate = ((2026 - 1980) << 9) | (11 << 5) | 12;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const dataBuf = Buffer.isBuffer(entry.content)
            ? entry.content
            : Buffer.from(entry.content, "utf8");
        const crc = crc32(dataBuf);
        const compressed = zlib.deflateRawSync(dataBuf, { level: 9 });
        const useDeflate = compressed.length < dataBuf.length;
        const payload = useDeflate ? compressed : dataBuf;
        const method = useDeflate ? 8 : 0;

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // signature
        localHeader.writeUInt16LE(20, 4); // version needed
        localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
        localHeader.writeUInt16LE(method, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(payload.length, 18);
        localHeader.writeUInt32LE(dataBuf.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, nameBuf, payload);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(method, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(payload.length, 20);
        centralHeader.writeUInt32LE(dataBuf.length, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralParts.push(centralHeader, nameBuf);
        offset += localHeader.length + nameBuf.length + payload.length;
    }

    const centralBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralBuf, eocd]);
}

export function buildHomePanelPackage(moduleDir = MODULE_DIR) {
    const manifestPath = path.join(moduleDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    const rootHtml = fs.readFileSync(path.join(moduleDir, "src/package_root.html"), "utf8");
    const rootJsx = fs.readFileSync(path.join(moduleDir, "src/HomePanelRoot.jsx"), "utf8");
    const queriesJs = fs.readFileSync(path.join(moduleDir, "src/HomePanelQueries.js"), "utf8");

    const metaFile = {
        formatVersion: 2,
        appVersion: "0.107.0",
        heliumModuleManifest: {
            moduleId: manifest.moduleId,
            version: manifest.version,
            compatibleTriliumRange: manifest.compatibleTriliumRange
        },
        files: [
            {
                isClone: false,
                noteId: "helium_home_panel_pkg_root",
                notePath: ["helium_home_panel_pkg_root"],
                title: `${manifest.moduleId} (v${manifest.version})`,
                notePosition: 10,
                prefix: "",
                isExpanded: true,
                type: "book",
                mime: "text/html",
                format: "html",
                dataFileName: "empyrean.home-panel.html",
                dirFileName: "empyrean.home-panel",
                attributes: [
                    { type: "label", name: "heliumModuleId", value: manifest.moduleId, isInheritable: false, position: 10 },
                    { type: "label", name: "heliumModuleVersion", value: manifest.version, isInheritable: false, position: 20 },
                    { type: "label", name: "heliumModuleRole", value: "code-root", isInheritable: false, position: 30 },
                    { type: "label", name: "excludeFromExport", value: "", isInheritable: false, position: 40 }
                ],
                attachments: [],
                children: [
                    {
                        isClone: false,
                        noteId: "helium_home_panel_jsx_root",
                        notePath: ["helium_home_panel_pkg_root", "helium_home_panel_jsx_root"],
                        title: "HomePanelRoot",
                        notePosition: 10,
                        prefix: "",
                        isExpanded: true,
                        type: "code",
                        mime: "text/jsx",
                        dataFileName: "HomePanelRoot.jsx",
                        dirFileName: "HomePanelRoot",
                        attributes: [
                            { type: "label", name: "heliumModuleId", value: manifest.moduleId, isInheritable: false, position: 10 },
                            { type: "label", name: "heliumModuleVersion", value: manifest.version, isInheritable: false, position: 20 },
                            { type: "label", name: "heliumModuleRole", value: "entry-jsx", isInheritable: false, position: 30 }
                        ],
                        attachments: [],
                        children: [
                            {
                                isClone: false,
                                noteId: "helium_home_panel_queries_js",
                                notePath: [
                                    "helium_home_panel_pkg_root",
                                    "helium_home_panel_jsx_root",
                                    "helium_home_panel_queries_js"
                                ],
                                title: "HomePanelQueries",
                                notePosition: 10,
                                prefix: "",
                                isExpanded: false,
                                type: "code",
                                mime: "application/javascript;env=frontend",
                                dataFileName: "HomePanelQueries.js",
                                attributes: [
                                    { type: "label", name: "heliumModuleId", value: manifest.moduleId, isInheritable: false, position: 10 },
                                    { type: "label", name: "heliumModuleVersion", value: manifest.version, isInheritable: false, position: 20 },
                                    { type: "label", name: "heliumModuleRole", value: "submodule-js", isInheritable: false, position: 30 }
                                ],
                                attachments: []
                            }
                        ]
                    }
                ]
            }
        ]
    };

    const entries = [
        { name: "!!!meta.json", content: JSON.stringify(metaFile, null, "\t") },
        { name: "empyrean.home-panel.html", content: rootHtml },
        { name: "empyrean.home-panel/HomePanelRoot.jsx", content: rootJsx },
        { name: "empyrean.home-panel/HomePanelRoot/HomePanelQueries.js", content: queriesJs }
    ];

    const zipBuffer = createDeterministicZipBuffer(entries);
    const distDir = path.join(moduleDir, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    const zipPath = path.join(distDir, `${manifest.moduleId}-${manifest.version}.zip`);
    fs.writeFileSync(zipPath, zipBuffer);

    return {
        zipPath,
        zipBuffer,
        metaFile,
        entries
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { zipPath, zipBuffer } = buildHomePanelPackage();
    console.log(`Built ${zipPath} (${zipBuffer.length} bytes)`);
}
