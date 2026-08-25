import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_EVIDENCE_IMAGES = 5;

function frameTimes(durationMs) {
  if (typeof durationMs === "number" && durationMs > 0) {
    const durationSeconds = durationMs / 1000;
    return [0.15, 0.5, 0.85].map((position) => Math.max(0, durationSeconds * position));
  }
  return [0, 2, 5];
}

async function downloadPhoto(url, outputPath, execute) {
  await execute("curl", ["-fsSL", "--max-time", "20", "--output", outputPath, url]);
}

async function extractVideoFrame(media, seconds, outputPath, execute) {
  await execute("ffmpeg", [
    "-v", "error",
    "-ss", seconds.toFixed(3),
    "-i", media.videoUrl,
    "-frames:v", "1",
    "-vf", "scale='min(1280,iw)':-2",
    "-q:v", "3",
    "-y",
    outputPath,
  ]);
}

/**
 * 抽取只供本次模型判断使用的代表帧。文件落在系统临时目录，调用方必须执行 cleanup；
 * 任一媒体失败只降低视觉证据数量，不阻断整条策展解析。
 */
export async function collectDesignEvidenceImages(media, {
  execute = execFileAsync,
  temporaryDirectory = os.tmpdir(),
} = {}) {
  const directory = await mkdtemp(path.join(temporaryDirectory, "x-design-evidence-"));
  const imagePaths = [];

  for (const [mediaIndex, item] of (media ?? []).entries()) {
    if (imagePaths.length >= MAX_EVIDENCE_IMAGES) break;
    if (item.type === "photo" && item.url) {
      const outputPath = path.join(directory, `${mediaIndex}-photo.jpg`);
      try {
        await downloadPhoto(item.url, outputPath, execute);
        imagePaths.push(outputPath);
      } catch {
        // 单张图片不可用时继续使用文本或其他媒体证据。
      }
      continue;
    }
    if (!item.videoUrl) continue;
    for (const [frameIndex, seconds] of frameTimes(item.durationMs).entries()) {
      if (imagePaths.length >= MAX_EVIDENCE_IMAGES) break;
      const outputPath = path.join(directory, `${mediaIndex}-frame-${frameIndex}.jpg`);
      try {
        await extractVideoFrame(item, seconds, outputPath, execute);
        imagePaths.push(outputPath);
      } catch {
        // 某个时间点可能超出实际时长；保留已经成功的代表帧。
      }
    }
  }

  const images = await Promise.all(imagePaths.map(async (imagePath) => ({
    data: (await readFile(imagePath)).toString("base64"),
    mediaType: "image/jpeg",
    path: imagePath,
    type: "image",
  })));

  return {
    cleanup: () => rm(directory, { force: true, recursive: true }),
    images,
  };
}
