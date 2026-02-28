import { FC } from 'react';
import { PointerBenefit } from './PointerBenefit';
import { FeatureSwitch } from './FeatureSwitch';
import { BackgroundPattern } from './BackgroundPattern';

export const ComponentRegistry: Record<string, FC<any>> = {
    PointerBenefit,
    FeatureSwitch,
    BackgroundPattern,
};
