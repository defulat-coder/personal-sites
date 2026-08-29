# Open Graph 字体

`noto-sans-sc-og.ttf` 是 [Google Fonts 的 Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 650 字重静态子集，只保留 `app/opengraph-image.tsx` 当前文案使用的字形。字体采用 SIL Open Font License 1.1，许可证见同目录 `OFL.txt`。

修改 Open Graph 文案后必须重新生成子集并运行 `tests/opengraph-image.test.tsx`；不要提交 17 MB 的完整源字体。
