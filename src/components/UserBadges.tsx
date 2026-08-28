import React from 'react';
import { ShieldCheck, CheckCircle2, Crown, Sparkles, Shield } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
  user?: Partial<UserProfile> | null;
  isAdmin?: boolean;
  isVip?: boolean;
  isVerified?: boolean;
  customTitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTitle?: boolean;
  className?: string;
}

export function UserBadges({
  user,
  isAdmin: propIsAdmin,
  isVip: propIsVip,
  isVerified: propIsVerified,
  customTitle: propCustomTitle,
  size = 'sm',
  showTitle = true,
  className = '',
}: Props) {
  const isAdmin = propIsAdmin ?? user?.isAdmin ?? false;
  const isVip = propIsVip ?? user?.isVip ?? false;
  const isVerified = propIsVerified ?? user?.isVerified ?? false;
  const customTitle = propCustomTitle ?? user?.customTitle;

  if (!isAdmin && !isVip && !isVerified && !customTitle) {
    return null;
  }

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizes = {
    xs: 'text-[9px] px-1 py-0.2',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
  };

  return (
    <div className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {/* Verified Badge */}
      {isVerified && (
        <span 
          title="Verified Account"
          className="inline-flex items-center text-blue-500 hover:text-blue-400 transition"
        >
          <CheckCircle2 className={`${iconSizes[size]} fill-blue-500 text-white stroke-[2.5]`} />
        </span>
      )}

      {/* Admin Badge */}
      {isAdmin && (
        <span
          title="System Administrator"
          className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 text-white font-extrabold shadow-xs tracking-wider uppercase ${textSizes[size]}`}
        >
          <Shield className={`${iconSizes[size]} fill-current text-white`} />
          <span>ADMIN</span>
        </span>
      )}

      {/* VIP Badge */}
      {isVip && !isAdmin && (
        <span
          title="VIP Member"
          className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-xs tracking-wider uppercase ${textSizes[size]}`}
        >
          <Crown className={`${iconSizes[size]} fill-current text-slate-950`} />
          <span>VIP</span>
        </span>
      )}

      {/* Custom Title Pill */}
      {showTitle && customTitle && (
        <span
          title={`Title: ${customTitle}`}
          className={`inline-flex items-center rounded-md font-medium border ${
            isAdmin
              ? 'bg-purple-950/40 text-purple-300 border-purple-800/60'
              : isVip
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : 'bg-slate-800/60 text-slate-300 border-slate-700/60'
          } ${textSizes[size]}`}
        >
          {customTitle}
        </span>
      )}
    </div>
  );
}
