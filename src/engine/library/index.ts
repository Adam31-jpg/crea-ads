import { FC } from 'react';
import { PointerBenefit } from './PointerBenefit';
import { FeatureSwitch } from './FeatureSwitch';
import { BackgroundPattern } from './BackgroundPattern';
import { SocialBadge } from './SocialBadge';
import { BenefitGrid } from './BenefitGrid';
import { ComparisonSlider } from './ComparisonSlider';
import { CleanIngredient } from './CleanIngredient';
import { ShapeOverlay } from './ShapeOverlay';
import { ScrollingRibbon } from './ScrollingRibbon';
import { OutlineText } from './OutlineText';

export const ComponentRegistry: Record<string, FC<any>> = {
    PointerBenefit,
    FeatureSwitch,
    BackgroundPattern,
    SocialBadge,
    BenefitGrid,
    ComparisonSlider,
    CleanIngredient,
    ShapeOverlay,
    ScrollingRibbon,
    OutlineText,
};
