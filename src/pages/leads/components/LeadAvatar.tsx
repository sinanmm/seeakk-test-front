import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { ENV } from '../../../config/env';

type LeadAvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  className?: string;
  textClassName?: string;
  localPreviewUrl?: string | null;
};

const avatarColors = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
];

// In-memory cache for failed/missing avatar URLs to prevent repeated requests
const failedUrlCache = new Set<string>();
// In-memory cache for resolved blob URLs across component remounts
const blobUrlCache = new Map<string, string>();

const LeadAvatar: React.FC<LeadAvatarProps> = ({
  name,
  imageUrl,
  className = 'h-11 w-11',
  textClassName = 'text-sm',
  localPreviewUrl,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    if (imageUrl && blobUrlCache.has(imageUrl)) {
      return blobUrlCache.get(imageUrl) || null;
    }
    return null;
  });
  const [failed, setFailed] = useState<boolean>(() => Boolean(imageUrl && failedUrlCache.has(imageUrl)));
  const initial = (name || 'Lead').trim().charAt(0).toUpperCase() || 'L';
  const color = useMemo(() => {
    const code = initial.charCodeAt(0) || 0;
    return avatarColors[code % avatarColors.length];
  }, [initial]);

  useEffect(() => {
    if (!imageUrl || localPreviewUrl) {
      setObjectUrl(null);
      setFailed(false);
      return undefined;
    }

    if (failedUrlCache.has(imageUrl)) {
      setFailed(true);
      setObjectUrl(null);
      return undefined;
    }

    if (blobUrlCache.has(imageUrl)) {
      setObjectUrl(blobUrlCache.get(imageUrl) || null);
      setFailed(false);
      return undefined;
    }

    let active = true;
    let nextUrl: string | null = null;
    setFailed(false);

    // Normalize absolute API URLs pointing to our backend to relative paths
    const requestPath = ENV.API_URL && imageUrl.startsWith(ENV.API_URL)
      ? imageUrl.slice(ENV.API_URL.length)
      : imageUrl;

    const isAbsolute = requestPath.startsWith('http://') || requestPath.startsWith('https://');
    if (isAbsolute) {
      setObjectUrl(requestPath);
      return undefined;
    }

    api.get(requestPath, { responseType: 'blob', _suppressGlobalErrorToast: true } as any)
      .then((response) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(response.data);
        blobUrlCache.set(imageUrl, nextUrl);
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        failedUrlCache.add(imageUrl);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [imageUrl, localPreviewUrl]);

  const src = localPreviewUrl || (!failed ? objectUrl : null);

  return (
    <div className={`${className} ${src ? 'bg-white' : color} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 shadow-sm ring-1 ring-gray-100`}>
      {src ? (
        <img
          src={src}
          alt={name ? `${name} profile` : 'Lead profile'}
          className="h-full w-full object-cover"
          onError={() => {
            if (imageUrl) failedUrlCache.add(imageUrl);
            setFailed(true);
          }}
        />
      ) : (
        <span className={`${textClassName} font-black uppercase text-white`}>{initial}</span>
      )}
    </div>
  );
};

export default LeadAvatar;

