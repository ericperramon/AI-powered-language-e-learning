export type VideoProvider = "youtube" | "vimeo" | "other";

export function getVideoEmbedUrl(videoUrl: string | null): string | null {
  if (!videoUrl) {
    return null;
  }

  try {
    const url = new URL(videoUrl);

    if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : videoUrl;
    }

    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    }

    if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    }

    return videoUrl;
  } catch {
    return videoUrl;
  }
}

export function getVideoProvider(embedUrl: string | null): VideoProvider {
  if (!embedUrl) return "other";
  if (embedUrl.includes("youtube.com/embed")) return "youtube";
  if (embedUrl.includes("player.vimeo.com")) return "vimeo";
  return "other";
}

export function getPlayableEmbedUrl(embedUrl: string, origin: string): string {
  const provider = getVideoProvider(embedUrl);

  if (provider === "youtube") {
    const separator = embedUrl.includes("?") ? "&" : "?";
    return `${embedUrl}${separator}enablejsapi=1&autoplay=1&origin=${encodeURIComponent(origin)}`;
  }

  if (provider === "vimeo") {
    const separator = embedUrl.includes("?") ? "&" : "?";
    return `${embedUrl}${separator}api=1&autoplay=1`;
  }

  return embedUrl;
}
