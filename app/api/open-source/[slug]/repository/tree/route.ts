import { GitHubRepositoryBrowserError, getGitHubRepositoryTree } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    return Response.json(await getGitHubRepositoryTree((await context.params).slug), {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    const status = error instanceof GitHubRepositoryBrowserError ? error.status : 500;
    const message = error instanceof Error ? error.message : "暂时无法读取原始仓库。";
    return Response.json({ error: message }, { status });
  }
}
