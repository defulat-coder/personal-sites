import { GitHubRepositoryBrowserError, getGitHubRepositoryFile } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return Response.json({ error: "缺少文件路径。" }, { status: 400 });

  try {
    return Response.json(await getGitHubRepositoryFile((await context.params).slug, path), {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    // 只有已知的浏览器代理错误可以透传 message；其余内部错误（zod、环境变量缺失等）只记日志。
    if (error instanceof GitHubRepositoryBrowserError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("读取原始文件失败", error);
    return Response.json({ error: "暂时无法读取原始文件。" }, { status: 500 });
  }
}
