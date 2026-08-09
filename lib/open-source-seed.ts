import { openSourceEntries } from "@/config/open-source-curation.mjs";

import type { OpenSourceEntry } from "@/lib/open-source-types";

/**
 * Public-safe editorial fields for the repositories already chosen for this
 * site. The Star synchronizer never creates entries from this list; it only
 * decides which already-synced records may receive a public projection.
 */
export const openSourceSeedEntries = openSourceEntries satisfies OpenSourceEntry[];
