export interface MarketingData {
    brandName?: string;
    productDescription: string;
    usps: string[];
    targetAudience: string;
    targetLanguage: string;
    offerText?: string;
    socialProof?: string;
    keyIngredient?: string;
    customCta?: string;
    websiteUrl?: string;
    phoneNumber?: string;
}

export interface BrickProps {
    data: MarketingData;
    onChange: (data: Partial<MarketingData>) => void;
    t?: any; // next-intl translation function
}
