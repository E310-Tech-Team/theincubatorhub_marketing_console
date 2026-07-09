import { apiClient } from '@/api/client';
import type { LinkAnalytics, TrackedLink } from '@/types';

const BASE = '/api/admin/marketing/links';

export async function listLinks(params: { marketing_campaign_id?: number; link_type?: string } = {}): Promise<TrackedLink[]> {
  const { data } = await apiClient.get(BASE, { params });
  return data.data.links;
}

/** Per-link click/conversion analytics (standalone or campaign links). */
export async function linkAnalytics(id: number): Promise<LinkAnalytics> {
  const { data } = await apiClient.get(`${BASE}/${id}/analytics`);
  return data.data;
}

export async function createLink(payload: {
  destination_url: string;
  link_type: string;
  label?: string;
  marketing_campaign_id?: number;
  marketing_category_id?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}): Promise<TrackedLink> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data.link;
}

export async function updateLink(
  id: number,
  payload: {
    destination_url?: string;
    link_type?: string;
    label?: string | null;
    marketing_campaign_id?: number | null;
    marketing_category_id?: number | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
  },
): Promise<TrackedLink> {
  const { data } = await apiClient.patch(`${BASE}/${id}`, payload);
  return data.data.link;
}

export async function deleteLink(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
