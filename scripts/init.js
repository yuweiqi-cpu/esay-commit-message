const fs = require('fs');
const path = require('path');

function createProjectStructure() {
  // 明确指定项目根目录
  // 方法1：假设脚本在项目根目录的scripts文件夹中
  const projectRoot = path.resolve(__dirname, '..');

  // 方法2：或者使用当前工作目录（运行脚本的位置）
  // const projectRoot = process.cwd();

  console.log(`项目根目录: ${projectRoot}`);

  // 定义需要创建的目录结构
  const dirs = [
    'src/types',
    'src/test',
    '.vscode',
    'resources',
    'out'  // TypeScript编译输出目录
  ];

  // 定义需要创建的文件
  const files = {
    '.gitignore': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
out/
dist/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db`,

    '.vscode/settings.json': `{
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "explicit"
    }
}`,

    '.vscode/extensions.json': `{
    "recommendations": [
        "ms-vscode.vscode-typescript-next",
        "ms-vscode.vscode-eslint"
    ]
}`
  };

  // 创建目录
  dirs.forEach(dir => {
    const dirPath = path.join(projectRoot, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ 创建目录: ${dir}`);
    } else {
      console.log(`📁 目录已存在: ${dir}`);
    }
  });

  // 创建文件
  Object.entries(files).forEach(([filePath, content]) => {
    const fullPath = path.join(projectRoot, filePath);
    const dirName = path.dirname(fullPath);

    // 确保目录存在
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 创建文件: ${filePath}`);
    } else {
      console.log(`📄 文件已存在: ${filePath}`);
    }
  });

  console.log('\n🎉 项目结构初始化完成！');
  console.log('下一步操作:');
  console.log('1. 运行 npm install 安装依赖');
  console.log('2. 运行 npm run compile 编译TypeScript');
  console.log('3. 按F5开始调试');
}

// 运行初始化
createProjectStructure();
