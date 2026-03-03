export function optimizeImageUrl(url: string, width = 900): string {
  if (!url) return url;

  if (!url.includes("images.unsplash.com")) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}auto=format&fit=crop&w=${width}&q=70`;
}

