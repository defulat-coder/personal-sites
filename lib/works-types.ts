export type WorkShot = {
  label: string;
  src: string;
};

export type WorkEntry = {
  order: number;
  period: string;
  repo?: string;
  role: string;
  shots: WorkShot[];
  slug: string;
  stack: string[];
  status: string;
  summary: string;
  title: string;
  url?: string;
};

export type Work = WorkEntry & {
  body: string;
};
