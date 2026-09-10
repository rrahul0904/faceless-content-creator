export type VideoMode = "presenter" | "broll";

export type ContentIdea = {
  id: string;
  topic: string;
  hook: string;
  script: string;
  statNumber: string;
  statLabel: string;
  caption: string;
  hashtags: string[];
  score: number;
  niche: string;
};

export type PipelineRequest = {
  niche?: string;
  mode?: VideoMode;
  autoPublish?: boolean;
  accountIds?: number[];
  scheduledFor?: string;
  timezone?: string;
  channelId?: string;
};

export type PipelineResult = {
  mode: "demo" | "live";
  idea: ContentIdea;
  presenterUrl?: string;
  renderJobId: string;
  renderStatus: string;
  previewUrl?: string;
  publishRequested: boolean;
  createdAt: string;
};

export type RenderJobStatus = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed" | "canceled" | "demo";
  finished: boolean;
  mediaUrl?: string;
  error?: string;
  raw?: unknown;
};
