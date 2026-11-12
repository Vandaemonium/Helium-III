import zlib from "node:zlib";
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