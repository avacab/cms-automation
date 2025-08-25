import { useState, useEffect } from 'react';
import { contentService, ContentItem, ContentType } from '../services/api';

export function useContent() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const contentData = await contentService.getContent();
      setContent(contentData);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  };

  const fetchContentTypes = async () => {
    try {
      const typesData = await contentService.getContentTypes();
      setContentTypes(typesData);
    } catch (err: any) {
      console.error('Failed to fetch content types:', err);
    }
  };

  useEffect(() => {
    fetchContent();
    fetchContentTypes();
  }, []);

  const refresh = () => {
    fetchContent();
    fetchContentTypes();
  };

  return {
    content,
    contentTypes,
    loading,
    error,
    refresh,
  };
}

export function useApiHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    try {
      setLoading(true);
      await contentService.healthCheck();
      setIsHealthy(true);
    } catch (err) {
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    isHealthy,
    loading,
    checkHealth,
  };
}