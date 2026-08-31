import type { Metadata } from "next";

import { CurationEntry, getCurationEntryMetadata } from "@/components/curation-entry";

type DesignEntryPageProps = { params: Promise<{ id: string }> };

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: DesignEntryPageProps): Promise<Metadata> {
  return getCurationEntryMetadata((await params).id, "design");
}

export default async function DesignEntryPage({ params }: DesignEntryPageProps) {
  return <CurationEntry context="design" id={(await params).id} />;
}
