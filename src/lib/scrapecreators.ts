import { prisma } from "@/lib/prisma";

const API_BASE = "https://api.scrapecreators.com/v1/facebook/adLibrary";
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export interface ScrapedAd {
    adArchiveId: string;
    snapshotUrl: string | null;
    adText: string | null;
    adTitle: string | null;
    ctaText: string | null;
    linkUrl: string | null;
    platform: string | null;
    startDate: Date | null;
    isActive: boolean;
    sourceUrl: string | null; // Direct link to Meta Ad Library
}

/**
 * Get real Meta ads for a competitor.
 * Uses company/ads?companyName=...&trim=false (1 credit per call).
 * Cache: 14-day TTL in CachedAd table.
 *
 * CONFIRMED DATA STRUCTURE (from real Lululemon API test):
 * - Images are in: snapshot.cards[0].original_image_url (HIGH QUALITY)
 *                  snapshot.cards[0].resized_image_url (600x600)
 * - snapshot.body.images is ALWAYS empty []
 * - Video thumbnails: snapshot.cards[0].video_preview_image_url
 * - For non-carousel ads: snapshot.videos[0].video_preview_image_url
 * - Text: snapshot.body.text
 * - Title: snapshot.title OR snapshot.cards[0].title
 * - CTA: snapshot.cta_text OR snapshot.cards[0].cta_text
 * - Link: snapshot.link_url OR snapshot.cards[0].link_url
 * - Results array is at: data.results (NOT data.ads, NOT data.searchResults)
 * - Ad Library URL: ad.url (e.g. "https://www.facebook.com/ads/library?id=849315954780396")
 */
export async function getCompetitorAds(
    competitorName: string,
    limit: number = 5,
): Promise<ScrapedAd[]> {
    const normalizedName = competitorName.toLowerCase().trim();

    // ── 1. Cache lookup ──────────────────────────────────────────
    const cached = await prisma.cachedAd.findMany({
        where: {
            competitorName: normalizedName,
            fetchedAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
        },
        orderBy: { startDate: "desc" },
        take: limit,
    });

    if (cached.length > 0) {
        console.log(`[scrapecreators] Cache hit for "${competitorName}": ${cached.length} ads`);
        return cached.map(mapCachedToScrapedAd);
    }

    // ── 2. API call — ONE request per competitor ──────────────────
    const apiKey = process.env.SCRAPECREATORS_API_KEY ?? "";
    if (!apiKey) {
        console.warn("[scrapecreators] No API key configured");
        return [];
    }

    console.log(`[scrapecreators] Fetching ads for "${competitorName}" via company/ads (trim=false)...`);

    try {
        const res = await fetch(
            `${API_BASE}/company/ads?companyName=${encodeURIComponent(competitorName)}&country=ALL&limit=${limit}&trim=false&status=ACTIVE`,
            { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(25000) },
        );

        if (!res.ok) {
            if (res.status === 402) {
                console.warn("[scrapecreators] API credits exhausted — buy more at https://app.scrapecreators.com");
            } else if (res.status === 400) {
                console.warn(`[scrapecreators] company/ads returned 400 for "${competitorName}" — name may not match a Facebook page`);
            } else {
                console.error(`[scrapecreators] company/ads failed: HTTP ${res.status} for "${competitorName}"`);
            }
            return [];
        }

        const data = await res.json();
        // CONFIRMED: results are in data.results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAds: any[] = data.results ?? data.ads ?? data.searchResults ?? [];

        if (rawAds.length === 0) {
            console.log(`[scrapecreators] No ads found for "${competitorName}"`);
            return [];
        }

        console.log(`[scrapecreators] Got ${rawAds.length} ads for "${competitorName}"`);

        // ── 3. Parse and cache ───────────────────────────────────
        return await parseAndCacheAds(rawAds.slice(0, limit), normalizedName);
    } catch (err) {
        console.error(`[scrapecreators] Error for "${competitorName}":`, err);
        return [];
    }
}

/**
 * Parse raw ad objects into ScrapedAd, upsert into DB cache.
 *
 * EXTRACTION PRIORITY (confirmed by real API test):
 * 1. snapshot.cards[0].original_image_url — BEST (high quality image)
 * 2. snapshot.cards[0].resized_image_url — GOOD (600x600)
 * 3. snapshot.cards[0].video_preview_image_url — for video ads
 * 4. snapshot.videos[0].video_preview_image_url — for non-carousel video ads
 * 5. null — no image available
 *
 * NOTE: snapshot.body.images is ALWAYS empty []. Never check it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseAndCacheAds(rawAds: any[], normalizedName: string): Promise<ScrapedAd[]> {
    const parsed: ScrapedAd[] = [];

    for (const ad of rawAds) {
        const adArchiveId = String(
            ad.ad_archive_id ?? ad.adArchiveID ?? ad.id ?? `${Date.now()}-${Math.random()}`,
        );

        // ── Extract snapshot URL — CORRECT paths (confirmed by test) ──
        const card = ad.snapshot?.cards?.[0];
        const snapshotUrl: string | null =
            card?.original_image_url          // High quality image
            ?? card?.resized_image_url         // 600x600 fallback
            ?? card?.video_preview_image_url   // Video thumbnail from card
            ?? ad.snapshot?.videos?.[0]?.video_preview_image_url  // Non-carousel video
            ?? null;
        // NOTE: Do NOT check snapshot.body.images — it's always empty []

        // ── Extract text fields ──
        const adText: string | null =
            ad.snapshot?.body?.text
            ?? card?.body
            ?? null;

        const adTitle: string | null =
            ad.snapshot?.title
            ?? card?.title
            ?? null;

        const ctaText: string | null =
            ad.snapshot?.cta_text
            ?? card?.cta_text
            ?? null;

        const linkUrl: string | null =
            ad.snapshot?.link_url
            ?? card?.link_url
            ?? null;

        // ── Platform & dates ──
        const platform: string | null =
            (ad.publisher_platform ?? [])[0]?.toLowerCase() ?? "facebook";

        let startDate: Date | null = null;
        if (ad.start_date_string) {
            startDate = new Date(ad.start_date_string);
        } else if (ad.start_date) {
            startDate = typeof ad.start_date === "number"
                ? new Date(ad.start_date * 1000)
                : new Date(ad.start_date);
        }

        // ── Source URL (direct link to Meta Ad Library) ──
        const sourceUrl: string | null =
            ad.url ?? `https://www.facebook.com/ads/library/?id=${adArchiveId}`;

        const scraped: ScrapedAd = {
            adArchiveId,
            snapshotUrl,
            adText,
            adTitle,
            ctaText,
            linkUrl,
            platform,
            startDate,
            isActive: ad.is_active ?? true,
            sourceUrl,
        };
        parsed.push(scraped);

        console.log(
            `  [ad] ${adArchiveId}: snapshot=${snapshotUrl ? "YES" : "NO"}, title="${adTitle?.slice(0, 40) ?? "N/A"}"`,
        );

        // ── Cache (upsert) ──
        try {
            await prisma.cachedAd.upsert({
                where: { adArchiveId },
                update: {
                    competitorName: normalizedName,
                    snapshotUrl,
                    adText,
                    adTitle,
                    ctaText,
                    linkUrl,
                    sourceUrl,
                    platform,
                    startDate,
                    isActive: scraped.isActive,
                    rawData: ad,
                    fetchedAt: new Date(),
                },
                create: {
                    competitorName: normalizedName,
                    adArchiveId,
                    snapshotUrl,
                    adText,
                    adTitle,
                    ctaText,
                    linkUrl,
                    sourceUrl,
                    platform,
                    startDate,
                    isActive: scraped.isActive,
                    rawData: ad,
                    fetchedAt: new Date(),
                },
            });
        } catch (e) {
            console.warn(`[scrapecreators] Cache failed for ${adArchiveId}:`, e);
        }
    }

    return parsed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCachedToScrapedAd(cached: any): ScrapedAd {
    return {
        adArchiveId: cached.adArchiveId,
        snapshotUrl: cached.snapshotUrl,
        adText: cached.adText,
        adTitle: cached.adTitle,
        ctaText: cached.ctaText,
        linkUrl: cached.linkUrl,
        platform: cached.platform,
        startDate: cached.startDate,
        isActive: cached.isActive,
        sourceUrl: cached.sourceUrl ?? `https://www.facebook.com/ads/library/?id=${cached.adArchiveId}`,
    };
}
