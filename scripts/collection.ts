import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取项目根目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');

// 配置
const BGM_USER = process.env.BANGUMI_USER || 'geekaven';
const BGM_URL = 'https://api.bgm.tv';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36',
};

// 类型定义
interface Subject {
  subject_id: number;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  total_episodes: number;
  eps: number;
  images: { large: string; common: string; medium: string; small: string };
  date?: string;
}

interface CollectionItem extends Subject {
  subject?: Subject; // 原始 API 可能包含 subject 对象
  ep_status: number;
  comment?: string;
  updated_at?: string;
}

// 通用 Fetch 封装
async function fetchJson<T>(url: string, params: Record<string, any> = {}): Promise<T | null> {
  const urlObj = new URL(url);
  Object.keys(params).forEach((key) => urlObj.searchParams.append(key, String(params[key])));

  try {
    // console.log(`[Fetch] ${urlObj.toString()}`);
    const res = await fetch(urlObj.toString(), { headers: HEADERS });
    if (!res.ok) {
      console.error(`[Error] Fetch failed: ${res.status} ${res.statusText} - ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[Error] Network error:`, error);
    return null;
  }
}

/**
 * 获取用户收藏列表（处理分页）
 */
async function getCollectionMap() {
  console.log(`- [INFO] Start fetching collection for user: ${BGM_USER}`);
  
  const collection: CollectionItem[] = [];
  const limit = 100;
  
  // 1. 获取第一页以确定总数
  const initData = await fetchJson<{ total: number, data: CollectionItem[] }>(
    `${BGM_URL}/v0/users/${BGM_USER}/collections`,
    { subject_type: 2, limit: limit, offset: 0 }
  );

  if (!initData || !initData.total) {
    console.error(`- [ERROR] No collection found or user not found.`);
    return null;
  }

  console.log(`- [INFO] Total items: ${initData.total}`);
  
  // 添加第一页数据
  if (initData.data) collection.push(...initData.data);

  // 2. 如果有多页，继续抓取
  const totalPage = Math.ceil(initData.total / limit);
  for (let page = 1; page < totalPage; page++) { // 从第1页开始（第0页已抓）
    console.log(`- [INFO] Fetching page ${page + 1}/${totalPage}`);
    const res = await fetchJson<{ data: CollectionItem[] }>(
      `${BGM_URL}/v0/users/${BGM_USER}/collections`,
      { subject_type: 2, limit, offset: page * limit }
    );
    if (res?.data) {
      collection.push(...res.data);
    }
  }

  // 3. 分类
  // type: 1=想看, 2=看过, 3=在看
  return {
    want: collection.filter((i) => i.type === 1),
    watched: collection.filter((i) => i.type === 2),
    watching: collection.filter((i) => i.type === 3),
  };
}

/**
 * 构建番剧数据（补充详细信息）
 */
async function buildSubject() {
  const collectionMap = await getCollectionMap();
  if (!collectionMap) return;

  // 确保输出目录存在
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (const [key, items] of Object.entries(collectionMap)) {
    const newData: CollectionItem[] = [];
    console.log(`- [INFO] Processing '${key}' list (${items.length} items)...`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const subjectId = item.subject_id;

      try {
        // 尝试从 CDN 获取更详细的条目信息 (Subject Data)
        // 这里的 CDN 数据结构通常比 User Collection 里的更完整
        const cdnUrl = `https://bgm-subject.tawawa.moe/${Math.floor(subjectId / 100)}/${subjectId}.json`;
        const subject = await fetchJson<Subject>(cdnUrl);

        if (subject) {
          // 合并数据：优先使用 CDN 的详细数据，保留用户的收藏状态(ep_status等)
          newData.push({
            ...item,
            date: subject.date,
            images: subject.images,
            name: subject.name,
            name_cn: subject.name_cn,
            summary: subject.summary,
            total_episodes: subject.total_episodes,
            eps: subject.eps,
            subject: undefined // 移除冗余的嵌套 subject
          });
        } else {
          // 如果 CDN 获取失败，回退使用 API 返回的基础数据
          // 注意：Bangumi API v0 返回的 item.subject 可能包含了基础信息
          const baseSubject = item.subject || {} as Subject;
          newData.push({
            ...item,
            ...baseSubject,
            subject: undefined
          });
        }
      } catch (e) {
        console.error(`- [WARN] Failed to process subject ${subjectId}`);
      }

      if(i % 10 === 0) console.log(`  Progress: ${i}/${items.length}`);
    }

    // 写入文件
    const filePath = path.join(DATA_DIR, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify({ data: newData, total: newData.length }));
    console.log(`- [SUCCESS] Wrote ${key}.json`);
  }
}

/**
 * 构建每日放送日历
 */
async function buildCalendar() {
  console.log('- [INFO] Fetching Calendar...');
  const data = await fetchJson<any[]>(`${BGM_URL}/calendar`);
  
  if (!data) {
    console.error('- [ERROR] Failed to fetch calendar');
    return;
  }

  const newData = data.map((d) => ({
    weekday: d.weekday,
    items: d.items
      .filter((item: any) => item.name_cn !== '') // 过滤掉没有中文译名的（通常是生肉或较冷门）
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        name_cn: item.name_cn,
        images: item.images,
        air_date: item.air_date,
        rank: item.rank,
        rating: item.rating
      }))
  }));

  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, 'calendar.json');
  await fs.writeFile(filePath, JSON.stringify(newData));
  console.log(`- [SUCCESS] Wrote calendar.json`);
}

// 主入口
(async () => {
  try {
    await buildCalendar();
    await buildSubject();
    console.log('\nAll tasks finished successfully.');
  } catch (error) {
    console.error('\nFatal Error:', error);
    process.exit(1);
  }
})();