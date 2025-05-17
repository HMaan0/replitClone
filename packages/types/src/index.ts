export type Project = {
  id: string;
  userId: string;
  name: string;
  language: Languages;
  createdAt: string;
  lastUsed: string | null;
};

export enum Languages {
  javascript = "javascript",
  typescript = "typescript",
  python = "python",
  react = "react",
  html = "html",
  cSharp = "cSharp",
  java = "java",
  rust = "rust",
  cPulsePulse = "c++",
  c = "c",
}

export type Queue = {
  type: Type;
  project: Project;
  ip: string | null;
};

export enum Type {
  up = "up",
  down = "down",
}

export type ALL_IPS = {
  id: string;
  ip: string;
}[];
