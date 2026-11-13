import build from "./build.js";
import packageJson from "../../package.json" with { type: "json" };
import { AppInfo } from "@triliumnext/commons";
import { getMaxMigrationVersion } from "../migrations/migrations.js";

// 41: in-app help notes became virtual (never persisted/synced); un-migrated peers would
//     still push _help entity changes, so they must upgrade before syncing.
const SYNC_VERSION = 41;
const CLIPPER_PROTOCOL_VERSION = "1.1";

/** Set by `buildBackend()` in `scripts/build-utils.ts`; undefined when running from source. */
declare const __TRILIUM_ASSET_BUILD__: string | undefined;

/**
 * The version in the cached asset URLs (`assets/v<assetVersion>/…`): the package version plus, in a
 * bundled build, that build's own ID, so a rebuild with the same version still changes every URL.
 */
export const assetVersion = typeof __TRILIUM_ASSET_BUILD__ === "string"
    ? `${packageJson.version}-${__TRILIUM_ASSET_BUILD__}`
    : packageJson.version;

const appInfo: AppInfo = {
    appVersion: packageJson.version,
    dbVersion: getMaxMigrationVersion(),
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision,
    clipperProtocolVersion: CLIPPER_PROTOCOL_VERSION,
    utcDateTime: new Date().toISOString()
}

export default appInfo;
