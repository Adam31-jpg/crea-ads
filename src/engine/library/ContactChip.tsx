import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { Globe, Phone } from 'lucide-react';
import { RemotionProps } from '../schema/project';

export const ContactChip: React.FC<{ props: RemotionProps }> = ({ props }) => {
    const frame = useCurrentFrame();
    const config = useVideoConfig();
    const { websiteUrl, phoneNumber, colors } = props;

    if (!websiteUrl && !phoneNumber) return null;

    // Simple opacity fade-in
    const opacity = Math.min(1, frame / 30);

    return (
        <div style={{
            position: 'absolute',
            bottom: '5%',
            right: '5%',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderRadius: '9999px',
            padding: '12px 24px',
            gap: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            opacity,
            zIndex: 100,
            overflow: 'hidden'
        }}>
            {websiteUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe color={colors.textPrimary} size={18} />
                    <span style={{
                        color: colors.textPrimary,
                        fontFamily: props.fontFamily || 'Inter',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        letterSpacing: '0.05em'
                    }}>
                        {websiteUrl}
                    </span>
                </div>
            )}

            {websiteUrl && phoneNumber && (
                <div style={{ width: '1px', height: '24px', backgroundColor: colors.textPrimary, opacity: 0.3 }} />
            )}

            {phoneNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone color={colors.textPrimary} size={18} />
                    <span style={{
                        color: colors.textPrimary,
                        fontFamily: props.fontFamily || 'Inter',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        letterSpacing: '0.05em'
                    }}>
                        {phoneNumber}
                    </span>
                </div>
            )}
        </div>
    );
};
