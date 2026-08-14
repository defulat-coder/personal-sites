export type WorkEntry = {
  order: number;
  period: string;
  role: string;
  slug: string;
  stack: string[];
  status: string;
  summary: string;
  title: string;
};

export type Work = WorkEntry & {
  body: string;
  repo?: string;
  url?: string;
};
