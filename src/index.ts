// @ts-ignore
import wantData from './data/want.json';
// @ts-ignore
import watchedData from './data/watched.json';
// @ts-ignore
import watchingData from './data/watching.json';
// @ts-ignore
import calendarData from './data/calendar.json';

// [新增] 引入静态资源处理工具
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
// [新增] 引入资源清单 (这是 Workers Sites 的魔法)
// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const DATA_MAP: Record<string, any> = {
  want: wantData,
  watched: watchedData,
  watching: watchingData,
};

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ==================================================
    // 1. API 路由处理 (优先匹配 API)
    // ==================================================
    
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // API: /bangumi
    if (path === '/bangumi' || path === '/api/bangumi') {
      const type = url.searchParams.get('type') || '';
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const limit = parseInt(url.searchParams.get('limit') || '12');

      if (!DATA_MAP[type]) {
        return new Response(JSON.stringify({ msg: `No collection ${type}` }), {
          status: 404, headers: CORS_HEADERS
        });
      }
      const collection = DATA_MAP[type];
      return new Response(JSON.stringify({
        data: collection.data.slice(offset, offset + limit),
        total: collection.total,
      }), { headers: CORS_HEADERS });
    }

    // API: /bangumi_total
    if (path === '/bangumi_total' || path === '/api/bangumi_total') {
      const res: Record<string, number> = {};
      for (const key in DATA_MAP) res[key] = DATA_MAP[key].total;
      return new Response(JSON.stringify(res), { headers: CORS_HEADERS });
    }

    // API: /calendar
    if (path === '/calendar' || path === '/api/calendar') {
      return new Response(JSON.stringify(calendarData), { headers: CORS_HEADERS });
    }

    // ==================================================
    // 2. 静态资源处理 (Demo 页面 & JS/CSS)
    // ==================================================
    
    try {
      // 尝试从 KV (public 目录) 获取静态文件
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      // 如果既不是 API 也不是静态文件，返回 404
      return new Response('Not Found', { status: 404 });
    }
  },
};