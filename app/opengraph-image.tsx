import { ImageResponse } from "next/og";

export const alt = "陈远｜运行中的工程档案";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f8f8f8",
        color: "#1c1c1e",
        display: "flex",
        height: "100%",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ borderLeft: "2px solid #1c1c1e", display: "flex", flexDirection: "column", justifyContent: "space-between", paddingLeft: "44px", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.08em" }}>CHEN YUAN · AGENT ENGINEERING</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 650, letterSpacing: "-0.05em" }}>运行中的工程档案</div>
          <div style={{ color: "#656568", display: "flex", fontSize: 30, marginTop: "24px" }}>持续输入 · 独立判断 · 真实构建</div>
        </div>
        <div style={{ display: "flex", fontSize: 24 }}>default-coder.lovemyrmb.cn</div>
      </div>
    </div>,
    size,
  );
}
