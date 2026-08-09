export type PrivateKnowledgeConceptIndex = {
  routeId: string;
  summary: string;
  title: string;
  topicSlug: string | null;
  type: string;
  sourceSystem: string;
};

export type PrivateKnowledgeConcept = PrivateKnowledgeConceptIndex & {
  body: string;
  conceptId: string;
  sourceFormat: string;
};

export function privateKnowledgeIsAvailable() {
  return false;
}

export function readPrivateTaxonomySummary() {
  return null;
}

export function listPrivateKnowledgeDomains() {
  return [];
}

export function listPrivateKnowledgeConcepts(_domainSlug: string): PrivateKnowledgeConceptIndex[] {
  void _domainSlug;
  return [];
}

export function readPrivateKnowledgeConcept(_routeId: string): PrivateKnowledgeConcept | null {
  void _routeId;
  return null;
}
