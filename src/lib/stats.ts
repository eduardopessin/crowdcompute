export type Stats = {
  target: 300;
  committed: number;
  totalResponses: number;
  modelVotes: {
    glm: number;
    kimi: number;
    qwen: number;
    community: number;
    other: number;
  };
};
