export interface MediaPreset {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  category: string;
}

export const COVER_PRESETS: MediaPreset[] = [
  // 16:9 Video Loops
  {
    id: 'cov-vid-aurora',
    name: 'Cosmic Aurora (Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    category: 'Video Loops',
  },
  {
    id: 'cov-vid-waves',
    name: 'Sunset Ocean Waves (Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-sea-waves-1198-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    category: 'Video Loops',
  },
  {
    id: 'cov-vid-neon-grid',
    name: 'Cyber Neon Tunnel (Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-41485-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
    category: 'Video Loops',
  },
  {
    id: 'cov-vid-particles',
    name: 'Golden Particles (Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-golden-particles-in-slow-motion-41477-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    category: 'Video Loops',
  },

  // 16:9 Photos
  {
    id: 'cov-img-cyber',
    name: 'Cyberpunk Tokyo',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1280&auto=format&fit=crop&q=80',
    category: '16:9 Photos',
  },
  {
    id: 'cov-img-mountains',
    name: 'Alpine Sunrise',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&auto=format&fit=crop&q=80',
    category: '16:9 Photos',
  },
  {
    id: 'cov-img-minimal',
    name: 'Minimal Gradient Wave',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&auto=format&fit=crop&q=80',
    category: '16:9 Photos',
  },
  {
    id: 'cov-img-galaxy',
    name: 'Deep Cosmos Nebula',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1280&auto=format&fit=crop&q=80',
    category: '16:9 Photos',
  },
];

export const AVATAR_PRESETS: MediaPreset[] = [
  // Looping Video Avatars
  {
    id: 'ava-vid-neon-sphere',
    name: 'Neon Sphere (Looping Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-golden-particles-in-slow-motion-41477-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    category: 'Video Avatars',
  },
  {
    id: 'ava-vid-cyber-pulse',
    name: 'Cyber Pulse (Looping Video)',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-41485-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=200&auto=format&fit=crop&q=80',
    category: 'Video Avatars',
  },
  // Photos
  {
    id: 'ava-img-3d-boy',
    name: 'Cyber 3D Character',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    category: 'Avatar Photos',
  },
  {
    id: 'ava-img-neon-girl',
    name: 'Neon Portrait',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    category: 'Avatar Photos',
  },
  {
    id: 'ava-img-minimal-art',
    name: 'Aesthetic Chill',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    category: 'Avatar Photos',
  },
  {
    id: 'ava-img-astronaut',
    name: 'Space Explorer',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80',
    category: 'Avatar Photos',
  },
];
