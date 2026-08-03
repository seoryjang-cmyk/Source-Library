// /api/storage.js
// 프론트엔드의 window.storage.get/set/delete/list 요청을 받아
// Upstash Redis(Vercel Marketplace의 Storage 연동)에 읽고 씁니다.
//
// Vercel 프로젝트에 Upstash Redis 연동을 추가하면 아래 두 환경변수가
// 자동으로 주입됩니다 (배포가이드.md 4단계 참고):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function redisKey(key, shared) {
  const isShared = shared === 'true' || shared === true;
  return `${isShared ? 'shared' : 'user'}:${key}`;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { key, prefix, shared } = req.query;

      // 목록 조회: /api/storage?prefix=xxx&shared=true
      if (prefix !== undefined) {
        const pattern = redisKey(prefix, shared) + '*';
        const rawKeys = await redis.keys(pattern);
        const keys = rawKeys.map(k => k.replace(/^(user:|shared:)/, ''));
        return res.status(200).json({ keys, prefix, shared: shared === 'true' });
      }

      if (!key) return res.status(400).json({ error: 'key is required' });

      const value = await redis.get(redisKey(key, shared));
      if (value === null || value === undefined) {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(200).json({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        shared: shared === 'true',
      });
    }

    if (req.method === 'POST') {
      const { key, value, shared } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });
      await redis.set(redisKey(key, shared), value);
      return res.status(200).json({ key, value, shared: !!shared });
    }

    if (req.method === 'DELETE') {
      const { key, shared } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });
      await redis.del(redisKey(key, shared));
      return res.status(200).json({ key, deleted: true, shared: !!shared });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
}
