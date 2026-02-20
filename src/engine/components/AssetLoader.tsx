import React, { useState, useEffect } from 'react';
import { continueRender, delayRender } from 'remotion';
import { Loader2, ImageOff } from 'lucide-react';

// Remotion specific asset loading helper
// We use continueRender/delayRender to pause the rendering until the asset is ready
// This is critical for Lambda rendering where we don't want to render blank frames

interface AssetLoaderProps {
    src: string;
    type: 'image' | 'video' | 'model'; // 'model' for future GLB support
    onLoad?: (data: any) => void;
    onError?: (err: Error) => void;
    children: (loadedSrc: string) => React.ReactNode;
    placeholder?: React.ReactNode;
}

export const AssetLoader: React.FC<AssetLoaderProps> = ({
    src,
    type,
    onLoad,
    onError,
    children,
    placeholder
}) => {
    const [handle] = useState(() => delayRender("Loading Asset: " + src));
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (type === 'image') {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                setIsLoaded(true);
                continueRender(handle);
                if (onLoad) onLoad(img);
            };
            img.onerror = (e) => {
                const err = new Error(`Failed to load image: ${src}`);
                setError(err);
                continueRender(handle); // Unblock render even on error
                if (onError) onError(err);
            };
        } else {
            // For now, immediately resolve other types or implement specific loaders
            // Future: GLTFLoader for 'model'
            setIsLoaded(true);
            continueRender(handle);
        }

        return () => {
            // Cleanup if needed
        };
    }, [src, type, handle, onLoad, onError]);

    if (error) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#333',
                color: '#ff5555'
            }}>
                <ImageOff size={48} />
                <span style={{ marginLeft: 10, fontFamily: 'sans-serif' }}>Asset Missing</span>
            </div>
        );
    }

    if (!isLoaded) {
        return placeholder || (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Loader2 className="animate-spin" color="#white" size={48} />
            </div>
        );
    }

    return <>{children(src)}</>;
};
