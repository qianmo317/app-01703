# 3D幸运抽奖系统

一个基于纯前端技术实现的3D抽奖应用，支持自定义奖品、导入名单、3D旋转动画等功能。

## How to Run

### Docker方式（推荐）

```bash
# 构建并启动
docker-compose up --build -d

# 访问地址
http://localhost:8081

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 本地运行




```bash
# 方式1: npm启动
cd frontend-lottery
npm start

# 方式2: Python服务器
cd frontend-lottery
python3 -m http.server 8081

# 方式3: 直接打开
直接用浏览器打开 frontend-lottery/index.html
```

## Services

| 服务 | 端口 | 访问地址 |
|------|------|----------|
| 3D抽奖系统 | 8081 | http://localhost:8081 |

## 测试账号

纯前端应用，无需登录。数据存储在浏览器 LocalStorage 中。

## 题目内容

开发一个3D抽奖HTML，要求：
1. 可以自定义奖品名称和中奖人数
2. 有中奖名单按钮，点击后弹出中奖名单窗口
3. 中奖人不能再次参与其他抽奖
4. 可以随机生成一些抽奖人名单
5. 可以导入参与抽奖名单文件（姓名、手机号码、部门），XLSX格式
6. 在窗口左边固定位置显示奖品和中奖人数
7. 点击开始后，抽奖人姓名不停在屏幕中间旋转
8. 可以自定义抽奖背景图片

---

## 功能特性

| 模块 | 功能 |
|------|------|
| 🎁 奖品管理 | 自定义奖品名称和人数、实时进度显示、删除奖品 |
| 👥 名单管理 | 随机生成、XLSX导入、下载模板、支持姓名/手机/部门 |
| 🎰 3D动画 | CSS3球体旋转、模糊晃动特效、速度可调、空格快捷键 |
| 🏆 中奖记录 | 自动排除已中奖者、分组查看、导出XLSX、烟花特效 |
| ⚙️ 系统设置 | 自定义背景（带预览）、速度调节、数据持久化、一键重置 |

## 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- CSS3 Transform 3D动画
- SheetJS xlsx.js（本地依赖）
- LocalStorage 数据持久化
- Nginx + Docker 部署

## 项目结构

```
├── frontend-lottery/
│   ├── index.html
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── lottery.js
│   │   ├── storage.js
│   │   ├── logger.js
│   │   ├── tests.js
│   │   └── lib/xlsx.full.min.js
│   └── assets/
├── docs/project_design.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 使用说明

1. **添加奖品** - 点击左侧"添加奖品"
2. **导入名单** - 点击右侧"导入"或"随机"生成
3. **选择奖品** - 点击左侧奖品列表
4. **开始抽奖** - 点击按钮或按空格键
5. **停止抽奖** - 再次点击或按空格键
6. **查看记录** - 点击"中奖名单"

## XLSX格式

| 姓名 | 手机号码 | 部门 |
|------|----------|------|
| 张三 | 13800138000 | 技术部 |
| 李四 | | 产品部 |

- 必须包含"姓名"列
- 手机号码和部门可选

## 浏览器支持

Chrome 60+ / Firefox 55+ / Safari 12+ / Edge 79+

## License

MIT
