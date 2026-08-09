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
    const status = error instanceof GitHubRepositoryBrowserError ? error.status : 500;
    const message = error instanceof Error ? error.message : "暂时无法读取原始文件。";
    return Response.json({ error: message }, { status });
  }
}
