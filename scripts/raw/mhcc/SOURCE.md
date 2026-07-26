# MHCC 原文来源说明

## 主来源（解析输入）

- 仓库：https://github.com/lyteword/mhenry-concise （`src/` 目录即该仓库 main 分支快照）
- 内容：Matthew Henry's Concise Commentary on the Whole Bible（马太亨利简明圣经注释，1706 年原著，公有领域）的 Markdown 重排版本，66 卷 × 每章一个文件
- 版权：仓库声明 **CC0-1.0**（见 `src/LICENSE`）；注释原文本身为 1706 年公有领域著作
- 获取方式：`curl -L https://codeload.github.com/lyteword/mhenry-concise/tar.gz/refs/heads/main`

## 第二来源（交叉核对/修复依据）

- 文件：`ccel_mhcc.xml`（ThML，约 7.9MB，1189 章全覆盖）
- 地址：https://ccel.org/ccel/henry/mhcc.xml （书页 https://ccel.org/ccel/henry/mhcc.html）
- 版权：CCEL 标注 **Public Domain**（Logos Research Systems 电子版的扫描/转录，页影来自 Google Books）

## 已知数据问题（convert-commentary.mjs 中 RELABEL 修复）

以下「缺段」经与 CCEL 版逐处核对，均为该版 MHCC 把相邻节注解合写在同一段、标题未拆开（内容完整），已按实际覆盖范围改标 verses：

- 太 13:24-43（原标题「24–30, 36–43」，正文残留已清理）
- 约 3:1-21、约 7:40-52（7:53 并入和合本 8:1）
- 诗 116:10-18（KJV 19 节 vs 和合本 18 节，末节合并）、诗 150:1-6
- 箴 14:12-13、箴 16:9-10、箴 16:19-20、箴 22:28-29
- 约叁 13-15
- 诗 95 的 1-7 / 7-11 为原书正常的跨节重叠分段，保留
