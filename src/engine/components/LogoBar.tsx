import React from 'react';
import type { TrustBarConfig } from '../schema/project';

interface LogoBarProps {
    trust_bar: TrustBarConfig;
    accentColor?: string;
}

// ─── Standard Trust Phrases ───────────────────────────────────────────────────
// These rotate across the bar. They echo the social-proof patterns that have
// the highest click-reassurance correlation in D2C performance marketing.
// Replace / extend this list with actual partner logos once design assets exist.
const TRUST_PHRASES = [
    'AS SEEN ON FORBES',
    'FEATURED IN VOGUE',
    'TRUSTED BY 50K+',
    'RATED #1 IN BEAUTY',
    'ELLE EDITORS PICK',
];

// ─── Separator SVG (diamond) ──────────────────────────────────────────────────
const Diamond: React.FC<{ color: string }> = ({ color }) => (
    <svg width="8" height="8" viewBox="0 0 8 8" style={{ margin: '0 12px', flexShrink: 0 }}>
        <polygon points="4,0 8,4 4,8 0,4" fill={color} />
    </svg>
);

/**
 * LogoBar — horizontal trust strip positioned at layout_config.trust_bar.y_position.
 *
 * Renders a row of trust phrases (or a custom label) separated by diamond SVG icons.
 * The bar sits behind a semi-transparent dark pill so it pops on any background.
 * If label is provided it replaces the default rotating set with a single string.
 */
export const LogoBar: React.FC<LogoBarProps> = ({
    trust_bar,
    accentColor = '#D4AF37',
}) => {
    const phrases = trust_bar.label ? [trust_bar.label] : TRUST_PHRASES;
    const textColor = accentColor;
    const bgColor = `rgba(0, 0, 0, ${Math.min(trust_bar.opacity * 0.55, 0.55)})`;

    return (
        <div
            style={{
                position: 'absolute',
                top: `${trust_bar.y_position}%`,
                left: 0,
                right: 0,
                opacity: trust_bar.opacity,
                zIndex: 24,
                display: 'flex',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: bgColor,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    borderRadius: 40,
                    padding: '6px 20px',
                    gap: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                {phrases.map((phrase, i) => (
                    <React.Fragment key={phrase}>
                        <span
                            style={{
                                color: textColor,
                                fontSize: 18,
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                fontFamily: 'Inter, sans-serif',
                                textTransform: 'uppercase',
                            }}
                        >
                            {phrase}
                        </span>
                        {i < phrases.length - 1 && (
                            <Diamond color={textColor} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
