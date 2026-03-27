const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RELEASE_DIR = 'release';
const APP_NAME = 'image-asset-management';

console.log('========================================');
console.log('  Image Asset Management - Release');
console.log('========================================\n');

// 清理旧发布包
function cleanRelease() {
  console.log('[1/4] Cleaning old release...');
  const releasePath = path.join(__dirname, '..', RELEASE_DIR);

  if (fs.existsSync(releasePath)) {
    fs.rmSync(releasePath, { recursive: true, force: true });
  }
}

// 安装依赖并构建
function installAndBuild() {
  const rootDir = path.join(__dirname, '..');

  console.log('\n[2/4] Installing backend dependencies...');
  execSync('npm install --omit=dev', {
    cwd: path.join(rootDir, 'server'),
    stdio: 'inherit'
  });

  console.log('\n[3/4] Building frontend...');
  const clientDir = path.join(rootDir, 'client');
  const clientNodeModules = path.join(clientDir, 'node_modules');
  if (fs.existsSync(clientNodeModules)) {
    console.log('  - Removing old node_modules...');
    fs.rmSync(clientNodeModules, { recursive: true, force: true });
  }
  // Install all dependencies including devDependencies
  execSync('npm install --include=dev', {
    cwd: clientDir,
    stdio: 'inherit'
  });
  // Run vite build directly using npx
  execSync('npx vite build', {
    cwd: clientDir,
    stdio: 'inherit'
  });
}

// 复制目录
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 创建发布目录结构
function createReleaseStructure() {
  const rootDir = path.join(__dirname, '..');
  const releasePath = path.join(rootDir, RELEASE_DIR, APP_NAME);

  const dirs = [
    path.join(releasePath, 'server', 'src'),
    path.join(releasePath, 'server', 'uploads'),
    path.join(releasePath, 'server', 'data'),
  ];

  dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
}

// 复制生产文件
function copyProductionFiles() {
  console.log('\n[4/4] Copying production files...');
  const rootDir = path.join(__dirname, '..');
  const releasePath = path.join(rootDir, RELEASE_DIR, APP_NAME);
  const serverRelease = path.join(releasePath, 'server');

  // 复制后端源码
  console.log('  - Copying backend source...');
  copyDir(path.join(rootDir, 'server', 'src'), path.join(serverRelease, 'src'));

  // 复制 node_modules
  console.log('  - Copying backend dependencies...');
  copyDir(path.join(rootDir, 'server', 'node_modules'), path.join(serverRelease, 'node_modules'));

  // 复制前端构建产物
  console.log('  - Copying frontend build...');
  copyDir(path.join(rootDir, 'server', 'public'), path.join(serverRelease, 'public'));

  // 复制配置文件
  console.log('  - Copying config files...');
  fs.copyFileSync(
    path.join(rootDir, 'server', 'package.json'),
    path.join(serverRelease, 'package.json')
  );
  fs.copyFileSync(
    path.join(rootDir, 'server', 'package-lock.json'),
    path.join(serverRelease, 'package-lock.json')
  );

  // 复制 .env.example 作为配置模板
  if (fs.existsSync(path.join(rootDir, 'server', '.env.example'))) {
    fs.copyFileSync(
      path.join(rootDir, 'server', '.env.example'),
      path.join(serverRelease, '.env.example')
    );
  }

  // 复制根目录文件
  fs.copyFileSync(
    path.join(rootDir, 'package.json'),
    path.join(releasePath, 'package.json')
  );

  // 复制启动脚本
  console.log('  - Copying startup scripts...');
  fs.copyFileSync(
    path.join(rootDir, 'scripts', 'start.bat'),
    path.join(releasePath, 'start.bat')
  );
  fs.copyFileSync(
    path.join(rootDir, 'scripts', 'start.sh'),
    path.join(releasePath, 'start.sh')
  );

  // 复制说明文档
  console.log('  - Copying documentation...');
  fs.copyFileSync(
    path.join(rootDir, 'DEPLOYMENT.md'),
    path.join(releasePath, 'DEPLOYMENT.md')
  );
}

// 主函数
function main() {
  try {
    cleanRelease();
    installAndBuild();
    createReleaseStructure();
    copyProductionFiles();

    console.log('\n========================================');
    console.log('  Release complete!');
    console.log(`  Output: ${RELEASE_DIR}/${APP_NAME}`);
    console.log('========================================');
  } catch (error) {
    console.error('\nRelease failed:', error.message);
    process.exit(1);
  }
}

main();