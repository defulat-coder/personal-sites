import type { Metadata } from "next";

import { CurationEntry, getCurationEntryMetadata } from "@/components/curation-entry";

type CurationEntryPageProps = { params: Promise<{ id: string }> };

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: CurationEntryPageProps): Promise<Metadata> {
  return getCurationEntryMetadata((await params).id, "curation");
}

export default async function CurationEntryPage({ params }: CurationEntryPageProps) {
  return <CurationEntry context="curation" id={(await params).id} />;
}
