import type { Stats } from '../../src/lib/stats';
export async function getStats(db: D1Database): Promise<Stats> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS totalResponses,
    COALESCE(SUM(would_pay_59 = 'yes'), 0) AS committed,
    COALESCE(SUM(model_vote = 'glm'), 0) AS glm,
    COALESCE(SUM(model_vote = 'kimi'), 0) AS kimi,
    COALESCE(SUM(model_vote = 'qwen'), 0) AS qwen,
    COALESCE(SUM(model_vote = 'community'), 0) AS community,
    COALESCE(SUM(model_vote = 'other'), 0) AS other
    FROM commitments WHERE consent = 1`,
    )
    .first<Record<string, number>>();
  if (!row) throw new Error('unavailable');
  return {
    target: 300,
    committed: row.committed,
    totalResponses: row.totalResponses,
    modelVotes: {
      glm: row.glm,
      kimi: row.kimi,
      qwen: row.qwen,
      community: row.community,
      other: row.other,
    },
  };
}
