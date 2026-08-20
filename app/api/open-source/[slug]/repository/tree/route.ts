import { GitHubRepositoryBrowserError, getGitHubRepositoryTree } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    return Response.json(await getGitHubRepositoryTree((await context.params).slug), {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    // 只有已知的浏览器代理错误可以透传 message；其余内部错误（zod、环境变量缺失等）只记日志。
    if (error instanceof GitHubRepositoryBrowserError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("读取原始仓库失败", error);
    return Response.json({ error: "暂时无法读取原始仓库。" }, { status: 500 });
  }
}
