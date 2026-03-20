import { prisma } from "@/lib/prisma";

const API_BASE = "https://api.scrapecreators.com/v1/facebook/adLibrary";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
}

/**
 * Get real Meta ads for a competitor.
 * Checks the DB cache first (7-day TTL) — only calls the API on a cache miss.
 *
 * Uses search/ads directly with the competitor name — simpler and more reliable
 * than the search/companies → company/ads pipeline.
 */
export async function getCompetitorAds(
    competitorName: string,
    limit: number = 5,
): Promise<ScrapedAd[]> {
    const normalizedName = competitorName.toLowerCase().trim();

    // ── 1. Cache lookup ──────────────────────────────────────────────────────
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

    // ── 2. Cache miss — call ScrapeCreators API ──────────────────────────────
    const apiKey = process.env.SCRAPECREATORS_API_KEY ?? "";
    if (!apiKey) {
        console.warn("[scrapecreators] No API key configured — skipping real-ad fetch");
        return [];
    }

    console.log(`[scrapecreators] Fetching ads for "${competitorName}" via search/ads...`);

    try {
        // ── Step A: Search ads directly by competitor name ───────────────────
        const searchRes = await fetch(
            `${API_BASE}/search/ads?query=${encodeURIComponent(competitorName)}&limit=${limit}&country=ALL`,
            { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(20000) },
        );

        if (!searchRes.ok) {
            console.error(`[scrapecreators] search/ads failed: ${searchRes.status} for "${competitorName}"`);
            return [];
        }

        const searchData = await searchRes.json();
        const rawAds: object[] = searchData.searchResults ?? searchData.ads ?? searchData.results ?? [];

        if (rawAds.length === 0) {
            console.log(`[scrapecreators] No ads found for "${competitorName}"`);
            return [];
        }

        console.log(`[scrapecreators] Got ${rawAds.length} ads for "${competitorName}"`);

        // ── Step B: Optionally enrich each ad with detail endpoint ───────────
        const enrichedAds = await Promise.all(
            rawAds.map(async (rawAd) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ad = rawAd as any;
                const adArchiveId = String(ad.ad_archive_id ?? ad.id ?? "");
                if (!adArchiveId) return ad;

                // Only fetch detail if snapshot URL is missing
                const hasSnapshot =
                    ad.snapshot?.body?.images?.[0]?.url ||
                    ad.snapshot?.cards?.[0]?.body?.images?.[0]?.url ||
                    ad.snapshot_url ||
                    ad.ad_snapshot_url;

                if (hasSnapshot) return ad;

                try {
                    const detailRes = await fetch(
                        `${API_BASE}/ad?id=${adArchiveId}`,
                        { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
                    );
                    if (detailRes.ok) {
                        const detail = await detailRes.json();
                        // Merge detail into the original ad object (detail takes precedence for snapshot)
                        return { ...ad, ...detail };
                    }
                } catch {
                    // Detail fetch is best-effort — silently ignore
                }
                return ad;
            }),
        );

        return await parseAndCacheAds(enrichedAds, limit, normalizedName);
    } catch (err) {
        console.error(`[scrapecreators] API error for "${competitorName}":`, err);
        return [];
    }
}

/**
 * Parse raw ad objects from ScrapeCreators into ScrapedAd, upsert into DB cache,
 * and return the parsed results.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseAndCacheAds(rawAds: object[], limit: number, normalizedName: string): Promise<ScrapedAd[]> {
    const parsed: ScrapedAd[] = [];

    for (const rawAd of rawAds.slice(0, limit)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ad = rawAd as any;
        const adArchiveId = String(
            ad.ad_archive_id ?? ad.id ?? `${Date.now()}-${Math.random()}`,
        );

        // Extract snapshot URL — ScrapeCreators nests it in various shapes
        let snapshotUrl: string | null = null;
        if (ad.snapshot?.body?.images?.[0]?.url) {
            snapshotUrl = ad.snapshot.body.images[0].url;
        } else if (ad.snapshot?.cards?.[0]?.body?.images?.[0]?.url) {
            snapshotUrl = ad.snapshot.cards[0].body.images[0].url;
        } else if (ad.snapshot_url) {
            snapshotUrl = ad.snapshot_url;
        } else if (ad.ad_snapshot_url) {
            snapshotUrl = ad.ad_snapshot_url;
        }

        const adText: string | null =
            ad.snapshot?.body?.text ?? ad.ad_creative_bodies?.[0] ?? null;
        const adTitle: string | null =
            ad.snapshot?.title ?? ad.snapshot?.cards?.[0]?.title ?? null;
        const ctaText: string | null =
            ad.snapshot?.cta_text ?? ad.cta_text ?? null;
        const linkUrl: string | null =
            ad.snapshot?.link_url ?? ad.ad_creative_link_captions?.[0] ?? null;
        const platform: string | null = (ad.publisher_platforms ?? [])[0] ?? "facebook";

        let startDate: Date | null = null;
        if (ad.start_date) {
            startDate =
                typeof ad.start_date === "number"
                    ? new Date(ad.start_date * 1000)
                    : new Date(ad.start_date);
        }

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
        };
        parsed.push(scraped);

        // Upsert into cache
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
                    platform,
                    startDate,
                    isActive: scraped.isActive,
                    rawData: ad,
                    fetchedAt: new Date(),
                },
            });
        } catch (e) {
            console.warn(`[scrapecreators] Cache upsert failed for ${adArchiveId}:`, e);
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
    };
}
