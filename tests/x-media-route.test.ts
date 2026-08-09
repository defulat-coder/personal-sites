import { describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/x-media/route";

const videoUrl = "https://video.twimg.com/amplify_video/1/vid/avc1/1280x720/video.mp4?tag=1";

describe("x-media route", () => {
  it("proxies an allowed X MP4 and preserves range playback headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("video-bytes", {
        headers: {
          "accept-ranges": "bytes",
          "content-range": "bytes 0-9/10",
          "content-type": "video/mp4",
        },
        status: 206,
      }),
    );
    const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`, {
      headers: { range: "bytes=0-9" },
    });

    const response = await GET(request);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 0-9/10");
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      headers: expect.any(Headers),
      method: "GET",
    }));
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toHaveProperty("get");
    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get("range")).toBe("bytes=0-9");
    fetchMock.mockRestore();
  });

  it("rejects any URL outside the allowlisted X video CDN", async () => {
    const response = await GET(new Request("http://localhost/api/x-media?url=https%3A%2F%2Fexample.com%2Ffile.mp4"));

    expect(response.status).toBe(400);
  });
});
