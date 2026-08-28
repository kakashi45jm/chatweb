import React, { useState } from 'react';
import { UserProfile } from '../types';

interface Props {
  user?: Partial<UserProfile> | null;
  name?: string;
  avatarColor?: string;
  avatarUrl?: string;
  avatarMediaType?: 'image' | 'video';
  customStatusEmoji?: string;
  isOnline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'hero';
  shape?: 'circle' | 'rounded-2xl' | 'rounded-xl' | 'rounded-lg' | 'rounded-md';
  showEmojiStatus?: boolean;
  showOnlineDot?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
  '2xl': 'w-16 h-16 text-xl',
  '3xl': 'w-20 h-20 text-2xl',
  hero: 'w-24 h-24 sm:w-28 sm:h-28 text-3xl sm:text-4xl',
};

const EMOJI_BADGE_SIZES = {
  xs: 'w-3.5 h-3.5 text-[8px] -bottom-0.5 -right-0.5',
  sm: 'w-4 h-4 text-[9px] -bottom-0.5 -right-0.5',
  md: 'w-4.5 h-4.5 text-[10px] -bottom-0.5 -right-0.5',
  lg: 'w-5 h-5 text-[11px] -bottom-1 -right-1',
  xl: 'w-6 h-6 text-xs -bottom-1 -right-1',
  '2xl': 'w-7 h-7 text-sm -bottom-1 -right-1',
  '3xl': 'w-8 h-8 text-base -bottom-1 -right-1',
  hero: 'w-8 h-8 sm:w-9 sm:h-9 text-base sm:text-lg -bottom-1 -right-1',
};

export function UserAvatar({
  user,
  name: propName,
  avatarColor: propColor,
  avatarUrl: propUrl,
  avatarMediaType: propMediaType,
  customStatusEmoji: propEmoji,
  isOnline,
  size = 'md',
  shape = 'rounded-2xl',
  showEmojiStatus = false,
  showOnlineDot = false,
  className = '',
  onClick,
}: Props) {
  const name = user?.name || propName || 'User';
  const color = user?.avatarColor || propColor || '#3b82f6';
  const url = user?.avatarUrl || propUrl;
  const mediaType = user?.avatarMediaType || propMediaType || 'image';
  const emoji = user?.customStatusEmoji || propEmoji;

  const [hasError, setHasError] = useState(false);

  const initial = name.charAt(0).toUpperCase();

  const shapeClass = 
    shape === 'circle' ? 'rounded-full' : 
    shape === 'rounded-lg' ? 'rounded-lg' : 
    shape === 'rounded-md' ? 'rounded-md' : 
    shape === 'rounded-xl' ? 'rounded-xl' : 'rounded-2xl';

  return (
    <div 
      className={`relative inline-flex shrink-0 select-none ${className}`}
      onClick={onClick}
    >
      <div
        className={`${SIZE_CLASSES[size]} ${shapeClass} flex items-center justify-center font-bold text-white shadow-xs overflow-hidden transition-transform`}
        style={{ backgroundColor: color }}
      >
        {url && !hasError ? (
          mediaType === 'video' ? (
            <video
              src={url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
            />
          ) : (
            <img
              src={url}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
              loading="lazy"
            />
          )
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {/* Custom Status Emoji Badge */}
      {showEmojiStatus && emoji && (
        <div 
          className={`absolute ${EMOJI_BADGE_SIZES[size]} rounded-full bg-white shadow-md flex items-center justify-center border border-slate-100`}
          title={`Status: ${emoji}`}
        >
          <span>{emoji}</span>
        </div>
      )}

      {/* Online indicator dot if emoji status is not shown */}
      {showOnlineDot && !showEmojiStatus && isOnline !== undefined && (
        <span 
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          }`} 
        />
      )}
    </div>
  );
}
