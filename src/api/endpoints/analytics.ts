import { apiClient } from '@/api/client';
import type { CampaignAnalytics, CampaignOutcomes } from '@/types';

export async function campaignAnalytics(broadcastId: number): Promise<CampaignAnalytics> {
  const { data } = await apiClient.get(`/api/admin/marketing/broadcasts/${broadcastId}/analytics`);
  return data.data;
}

/**
 * Downstream outcomes: what a campaign's signups went on to do.
 *
 * The `analytics` endpoint's "conversions" are registrations. This follows the
 * same people through KYC, quiz, and enrolment, with cost per outcome — so a
 * campaign that buys curious signups is distinguishable from one that buys
 * learners.
 */
export async function campaignOutcomes(campaignId: number): Promise<CampaignOutcomes> {
  const { data } = await apiClient.get(`/api/admin/marketing/campaigns/${campaignId}/outcomes`);
  return data.data;
}

/** Which tables the outcome export can produce (mirrors CampaignOutcomeExport::SECTIONS). */
export const OUTCOME_SECTIONS = [
  { value: 'funnel', label: 'Campaign funnel' },
  { value: 'by_link', label: 'Funnel by link' },
] as const;

/**
 * Download the outcome report as CSV.
 *
 * Built server-side from the same service call that renders the page, so the
 * file cannot disagree with what is on screen.
 */
export async function exportCampaignOutcomes(
  campaignId: number,
  section: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get(`/api/admin/marketing/campaigns/${campaignId}/outcomes/export`, {
    params: { section },
    responseType: 'blob',
  });

  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob: response.data as Blob,
    filename: match?.[1] ?? `campaign-${campaignId}-outcomes-${section}.csv`,
  };
}
