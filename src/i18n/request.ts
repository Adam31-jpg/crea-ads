import { getRequestConfig } from 'next-intl/server';

const SUPPORTED_LOCALES = ['fr', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

async function resolveLocale(): Promise<Locale> {
    try {
        const { cookies, headers } = await import('next/headers');

        // 1. Check cookie (explicit user preference)
        const cookieStore = await cookies();
        const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

        if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
            return cookieLocale as Locale;
        }

        // 2. Check Accept-Language header
        const headerStore = await headers();
        const acceptLanguage = headerStore.get('accept-language') ?? '';

        const preferred = acceptLanguage
            .split(',')
            .map((lang: string) => lang.split(';')[0].trim().toLowerCase().slice(0, 2))
            .find((lang: string) => SUPPORTED_LOCALES.includes(lang as Locale));

        if (preferred) return preferred as Locale;
    } catch {
        // During static pre-rendering (/_not-found, etc.), cookies()/headers() are unavailable
    }

    // 3. Default to FR
    return 'fr';
}

export default getRequestConfig(async () => {
    const locale = await resolveLocale();

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
