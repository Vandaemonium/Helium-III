import { assetVersion } from "@triliumnext/core/src/services/app_info.js";

import { isDev } from "./utils";

/**
 * The URL prefix for assets (e.g. `assets/v1.2.3-<build ID>`; see `assetVersion`).
 */
export const assetUrlFragment = `assets/v${assetVersion}`;

/**
 * Similar to the {@link assetUrlFragment}, but on dev mode it also contains the `/src` suffix.
 */
const assetPath = isDev ? assetUrlFragment + "/src" : assetUrlFragment;

export default assetPath;
