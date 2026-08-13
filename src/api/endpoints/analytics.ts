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
