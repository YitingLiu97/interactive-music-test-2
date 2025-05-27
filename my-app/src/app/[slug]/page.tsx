// my-app/src/app/[slug]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BoundingBox from '@/Components/BoundingBox';
import { JsonInfo } from '@/app/types/audioType';

export default function DynamicContentPage() {
  const params = useParams();
  const slug = params.slug as string;

  console.log("slug is "+slug);
  
  const [contentData, setContentData] = useState<JsonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/content/${slug}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load content: ${response.statusText}`);
        }
        
        const data: JsonInfo = await response.json();
        setContentData(data);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [slug]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading {slug}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Still render BoundingBox with default content if there's an error
    console.warn("Error loading content, falling back to default:", error);
    return <BoundingBox />;
  }

  // Render BoundingBox regardless of whether contentData exists
  // It will handle the fallback internally
  return (
    <BoundingBox contentData={contentData || undefined}
    />
  );
}