import Link from 'next/link';
import { VisualStoryStudio } from '@/components/visual-story-studio';

export const metadata = {
  title: 'Visual Story Studio · Creator Console',
  description: 'Generate branded animated technical visuals from a prompt.',
};

export default function VisualStoryPage() {
  return (
    <>
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 50 }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 999,
            padding: '9px 13px',
            background: 'rgba(7,11,22,.86)',
            color: '#f7f8fc',
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            backdropFilter: 'blur(12px)',
          }}
        >
          Creator home
        </Link>
      </div>
      <VisualStoryStudio />
    </>
  );
}
