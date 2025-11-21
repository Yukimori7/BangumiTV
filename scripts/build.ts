import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 读取 package.json 获取版本信息
const pkgPath = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const banner = [
  `/*! BangumiTV v${pkg.version}`,
  `Author: ${pkg.author || 'GeeKaven'}`,
  `Homepage: ${pkg.homepage || ''}`,
  `License: ${pkg.license} */`
].join(' | ');

console.log(`- [INFO] Building frontend assets for v${pkg.version}...`);

// 确保输出目录存在
const DIST_DIR = path.join(ROOT_DIR, 'public/dist');
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

async function build() {
  try {
    // 1. 打包 JS
    await esbuild.build({
      entryPoints: [path.join(ROOT_DIR, 'public/src/bangumi.js')],
      outfile: path.join(DIST_DIR, 'bangumi.js'),
      bundle: true,      // 即使只有一个文件，bundle 也能处理潜在的导入并优化
      minify: true,      // 压缩
      target: ['es2015'], // 兼容性目标
      platform: 'browser',
      banner: { js: banner },
      sourcemap: false,  // 生产环境通常不需要，如果需要调试可改为 true
    });
    console.log('- [SUCCESS] bangumi.js built.');

    // 2. 打包 CSS
    await esbuild.build({
      entryPoints: [path.join(ROOT_DIR, 'public/src/bangumi.css')],
      outfile: path.join(DIST_DIR, 'bangumi.css'),
      bundle: true,
      minify: true,
      banner: { css: banner },
      loader: { '.png': 'dataurl', '.jpg': 'dataurl' } // 如果CSS引用了图片，自动转base64
    });
    console.log('- [SUCCESS] bangumi.css built.');

  } catch (error) {
    console.error('- [ERROR] Build failed:', error);
    process.exit(1);
  }
}

build();