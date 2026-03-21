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
 * Clean competitor name for Facebook Ad Library lookup.
 * Facebook page names don't contain parentheses, ® symbols, or "Inc."/"Ltd." etc.
 *
 * Examples:
 *   "Solidpharma (Pure B Forte)" → "Solidpharma"
 *   "Prowise Healthcare (PROSTRIP®)" → "Prowise Healthcare"
 *   "VitaminExpress (Vitality Nutritionals)" → "VitaminExpress"
 *   "Essential Source, Inc." → "Essential Source"
 *   "Calmour Health" → "Calmour Health" (unchanged)
 */
function cleanCompanyName(name: string): string {
    return name
        .replace(/\s*\([^)]*\)\s*/g, " ")       // Remove parenthetical content
        .replace(/[®™©]/g, "")                   // Remove trademark symbols
        .replace(/,?\s*(Inc\.?|Ltd\.?|LLC|GmbH|S\.?A\.?|Co\.?)\s*$/i, "") // Remove legal suffixes
        .replace(/\s+/g, " ")                    // Collapse whitespace
        .trim();
}

/**
 * Get real Meta ads for a competitor.
 * Uses company/ads?companyName=...&trim=false (1 credit per call).
 * Cache: 14-day TTL in CachedAd table.
 *
 * CONFIRMED DATA STRUCTURE (from real Lululemon API test):
 * - Images: snapshot.cards[0].original_image_url (HIGH QUALITY)
 *           snapshot.cards[0].resized_image_url (600x600)
 * - snapshot.body.images is ALWAYS empty []
 * - Text: snapshot.body.text
 * - Title: snapshot.title OR snapshot.cards[0].title
 * - Results: data.results (NOT data.ads, NOT data.searchResults)
 * - Ad Library URL: ad.url
 *
 * Deduplication: ads sharing the same snapshotUrl (DCO variants) are collapsed to one.
 * Fetch 15 to compensate for dedup losses, then slice to limit.
 */
export async function getCompetitorAds(
    competitorName: string,
    limit: number = 5,
): Promise<ScrapedAd[]> {
    const cleanedName = cleanCompanyName(competitorName);
    const normalizedName = cleanedName.toLowerCase().trim();

    // ── 1. Cache lookup ──────────────────────────────────────────
    const cached = await prisma.cachedAd.findMany({
        where: {
            competitorName: normalizedName,
            fetchedAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
        },
        orderBy: { startDate: "desc" },
        take: limit * 3, // pull extra so dedup can work
    });

    if (cached.length > 0) {
        console.log(`[scrapecreators] Cache hit for "${competitorName}": ${cached.length} ads`);
        return deduplicateBySnapshot(cached.map(mapCachedToScrapedAd)).slice(0, limit);
    }

    // ── 2. API call — fetch 15, dedup, then slice to limit ──────
    const apiKey = process.env.SCRAPECREATORS_API_KEY ?? "";
    if (!apiKey) {
        console.warn("[scrapecreators] No API key configured");
        return [];
    }

    console.log(`[scrapecreators] Fetching ads for "${competitorName}" (cleaned: "${cleanedName}") via company/ads (trim=false)...`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawAds: any[] = await fetchCompanyAds(cleanedName, 15, apiKey);

    // ── 3. Fallback: try the parenthetical sub-name ──────────────
    if (rawAds.length === 0) {
        const altName = competitorName.match(/\(([^)]+)\)/)?.[1]?.replace(/[®™©]/g, "").trim();
        if (altName && altName !== cleanedName) {
            console.log(`[scrapecreators] Retrying with parenthetical name: "${altName}"`);
            rawAds = await fetchCompanyAds(altName, 15, apiKey);
        }
    }

    if (rawAds.length === 0) {
        console.log(`[scrapecreators] No ads found for "${competitorName}"`);
        return [];
    }

    console.log(`[scrapecreators] Got ${rawAds.length} raw ads for "${competitorName}"`);
    const parsed = await parseAndCacheAds(rawAds, normalizedName);

    // ── 4. Dedup by snapshotUrl (DCO variants share same image) ──
    const deduped = deduplicateBySnapshot(parsed);
    console.log(`[scrapecreators] After dedup: ${deduped.length}/${parsed.length} unique ads for "${competitorName}"`);

    return deduped.slice(0, limit);
}

/**
 * Like getCompetitorAds but for Expand Analysis.
 * Returns ads whose snapshotUrl is NOT in the excludeUrls set.
 * Pulls from cache first (without TTL limit), then fresh fetch if needed.
 */
export async function getExpandAds(
    competitorName: string,
    excludeUrls: Set<string>,
    limit: number = 5,
): Promise<ScrapedAd[]> {
    const cleanedName = cleanCompanyName(competitorName);
    const normalizedName = cleanedName.toLowerCase().trim();

    // Pull all cached ads (ignoring TTL for expand — we want everything we've ever fetched)
    const allCached = await prisma.cachedAd.findMany({
        where: { competitorName: normalizedName },
        orderBy: { startDate: "desc" },
        take: 50,
    });

    const fromCache = deduplicateBySnapshot(allCached.map(mapCachedToScrapedAd))
        .filter((ad) => ad.snapshotUrl && !excludeUrls.has(ad.snapshotUrl));

    if (fromCache.length >= limit) {
        return fromCache.slice(0, limit);
    }

    // Need fresh ads — fetch 30 from API
    const apiKey = process.env.SCRAPECREATORS_API_KEY ?? "";
    if (!apiKey) return fromCache.slice(0, limit);

    console.log(`[scrapecreators] Expand: fetching 30 fresh ads for "${competitorName}"...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawAds: any[] = await fetchCompanyAds(cleanedName, 30, apiKey);

    if (rawAds.length === 0) {
        const altName = competitorName.match(/\(([^)]+)\)/)?.[1]?.replace(/[®™©]/g, "").trim();
        if (altName && altName !== cleanedName) {
            rawAds = await fetchCompanyAds(altName, 30, apiKey);
        }
    }

    if (rawAds.length === 0) return fromCache.slice(0, limit);

    const parsed = await parseAndCacheAds(rawAds, normalizedName);
    const deduped = deduplicateBySnapshot(parsed)
        .filter((ad) => ad.snapshotUrl && !excludeUrls.has(ad.snapshotUrl));

    return deduped.slice(0, limit);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCompanyAds(companyName: string, fetchLimit: number, apiKey: string): Promise<any[]> {
    try {
        const res = await fetch(
            `${API_BASE}/company/ads?companyName=${encodeURIComponent(companyName)}&country=ALL&limit=${fetchLimit}&trim=false&status=ACTIVE`,
            { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(25000) },
        );

        if (!res.ok) {
            if (res.status === 402) {
                console.warn("[scrapecreators] API credits exhausted");
            } else if (res.status === 400) {
                console.warn(`[scrapecreators] 400 for "${companyName}" — name may not match a Facebook page`);
            } else {
                console.error(`[scrapecreators] HTTP ${res.status} for "${companyName}"`);
            }
            return [];
        }

        const data = await res.json();
        return data.results ?? data.ads ?? data.searchResults ?? [];
    } catch (err) {
        console.error(`[scrapecreators] Fetch error for "${companyName}":`, err);
        return [];
    }
}

function deduplicateBySnapshot(ads: ScrapedAd[]): ScrapedAd[] {
    const seen = new Set<string>();
    return ads.filter((ad) => {
        if (!ad.snapshotUrl) return false;
        if (seen.has(ad.snapshotUrl)) {
            console.log(`  [dedup] Skipping duplicate image for ad ${ad.adArchiveId}`);
            return false;
        }
        seen.add(ad.snapshotUrl);
        return true;
    });
}

/**
 * Parse raw ad objects into ScrapedAd, upsert into DB cache.
 *
 * EXTRACTION PRIORITY (confirmed by real API test):
 * 1. snapshot.cards[0].original_image_url — BEST (high quality)
 * 2. snapshot.cards[0].resized_image_url — GOOD (600x600)
 * 3. snapshot.cards[0].video_preview_image_url — video thumbnail from card
 * 4. snapshot.videos[0].video_preview_image_url — non-carousel video
 * 5. null — no image
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

        const card = ad.snapshot?.cards?.[0];
        const snapshotUrl: string | null =
            card?.original_image_url
            ?? card?.resized_image_url
            ?? card?.video_preview_image_url
            ?? ad.snapshot?.videos?.[0]?.video_preview_image_url
            ?? null;

        const adText: string | null = ad.snapshot?.body?.text ?? card?.body ?? null;
        const adTitle: string | null = ad.snapshot?.title ?? card?.title ?? null;
        const ctaText: string | null = ad.snapshot?.cta_text ?? card?.cta_text ?? null;
        const linkUrl: string | null = ad.snapshot?.link_url ?? card?.link_url ?? null;
        const platform: string | null = (ad.publisher_platform ?? [])[0]?.toLowerCase() ?? "facebook";
        const sourceUrl: string | null = ad.url ?? `https://www.facebook.com/ads/library/?id=${adArchiveId}`;

        let startDate: Date | null = null;
        if (ad.start_date_string) {
            startDate = new Date(ad.start_date_string);
        } else if (ad.start_date) {
            startDate = typeof ad.start_date === "number"
                ? new Date(ad.start_date * 1000)
                : new Date(ad.start_date);
        }

        const scraped: ScrapedAd = {
            adArchiveId, snapshotUrl, adText, adTitle, ctaText,
            linkUrl, platform, startDate, isActive: ad.is_active ?? true, sourceUrl,
        };
        parsed.push(scraped);

        console.log(`  [ad] ${adArchiveId}: snapshot=${snapshotUrl ? "YES" : "NO"}, title="${adTitle?.slice(0, 40) ?? "N/A"}"`);

        try {
            await prisma.cachedAd.upsert({
                where: { adArchiveId },
                update: { competitorName: normalizedName, snapshotUrl, adText, adTitle, ctaText, linkUrl, sourceUrl, platform, startDate, isActive: scraped.isActive, rawData: ad, fetchedAt: new Date() },
                create: { competitorName: normalizedName, adArchiveId, snapshotUrl, adText, adTitle, ctaText, linkUrl, sourceUrl, platform, startDate, isActive: scraped.isActive, rawData: ad, fetchedAt: new Date() },
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
