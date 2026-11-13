import { afterEach, describe, expect, it, vi } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

describe("asset_path", () => {
    afterEach(() => {
        vi.resetModules();
        vi.doUnmock("./utils");
        vi.unstubAllGlobals();
    });

    it("puts the bundle's build ID after the version, in the app's and the share pages' paths alike", async () => {
        vi.resetModules();
        vi.doMock("./utils", () => ({ isDev: false }));
        vi.stubGlobal("__TRILIUM_ASSET_BUILD__", "mabc123");

        const mod = await import("./asset_path.js");
        const { assetUrlFragment: shareFragment } = await import("@triliumnext/core/src/share/content_renderer.js");
        expect(mod.default).toBe(`assets/v${packageJson.version}-mabc123`);
        expect(shareFragment).toBe(mod.assetUrlFragment);
    });

    it("appends /src suffix in dev mode", async () => {
        vi.resetModules();
        vi.doMock("./utils", () => ({ isDev: true }));

        const mod = await import("./asset_path.js");
        expect(mod.assetUrlFragment).toBe(`assets/v${packageJson.version}`);
        expect(mod.default).toBe(`assets/v${packageJson.version}/src`);
    });

    it("omits /src suffix outside dev mode", async () => {
        vi.resetModules();
        vi.doMock("./utils", () => ({ isDev: false }));

        const mod = await import("./asset_path.js");
        expect(mod.default).toBe(`assets/v${packageJson.version}`);
    });
});
