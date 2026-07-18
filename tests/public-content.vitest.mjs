import { describe, expect, it } from "vitest";

import {
  buildPublicContentModel,
  canonicalJson,
  scanPublicValue,
} from "../scripts/build-public-content.mjs";
import {
  publicContentManifestSchema,
  publicContentProjectionSchema,
} from "../scripts/lib/public-content-schema.mjs";

describe("public content projection", () => {
  it("publishes only OKF index-backed sources", async () => {
    const { manifest } = await buildPublicContentModel();

    expect(new Set(manifest.sources.map((source) => source.kind))).toEqual(
      new Set(["index-source"]),
    );
  });

  it("is deterministic and schema-valid", async () => {
    const first = await buildPublicContentModel();
    const second = await buildPublicContentModel();

    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(publicContentProjectionSchema.safeParse(first.projection).success).toBe(
      true,
    );
    expect(publicContentManifestSchema.safeParse(first.manifest).success).toBe(
      true,
    );
  });

  it("accounts for every selected record across every approved category", async () => {
    const { manifest, projection } = await buildPublicContentModel();
    const categories = new Set(projection.items.map((item) => item.category));

    expect(categories).toEqual(
      new Set(["identity", "project", "knowledge", "practice"]),
    );
    expect(manifest.selectedCount).toBe(
      manifest.publishedCount + manifest.excludedCount,
    );
    expect(manifest.records).toHaveLength(manifest.selectedCount);
    expect(manifest.silentDropCount).toBe(0);
    expect(Object.values(manifest.findings)).toEqual([0, 0, 0, 0]);
  });

  it("detects credentials, personal contact data, and private paths", () => {
    const scan = scanPublicValue({
      privatePath: "knowledge/private/example.md",
      contact: "person@example.com",
      credential: "Bearer abcdefghijklmnopqrstuvwxyz123456",
    });

    expect(scan.privateReferenceFindings).not.toHaveLength(0);
    expect(scan.privacyFindings).not.toHaveLength(0);
    expect(scan.secretFindings).not.toHaveLength(0);
  });
});
