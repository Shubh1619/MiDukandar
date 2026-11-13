import type { MetadataRoute } from "next";

const BASE_URL = (
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://midukandar.onrender.com"
).replace(/\/$/, "");

/**
 * Public pages only. Authenticated app routes are disallowed in robots.txt, so
 * they are intentionally left out of the sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
    { path: "/refund", changeFrequency: "yearly", priority: 0.4 },
  ];

  const lastModified = new Date();
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
