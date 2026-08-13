import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  MailX,
  MousePointerClick,
  Send,
  Target,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiErrorMessage } from '@/api/errors';
import { campaignAnalytics } from '@/api/endpoints/analytics';
import { listBroadcasts } from '@/api/endpoints/broadcasts';
import CampaignOutcomes from '@/components/CampaignOutcomes';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import MetricCard, { type MetricTone } from '@/components/MetricCard';
import CountUp from '@/components/motion/CountUp';
import Reveal from '@/components/motion/Reveal';
import PageHeader from '@/components/layout/PageHeader';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { linkTypeLabel } from '@/content/linkTypes';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { CampaignAnalytics } from '@/types';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
function money(v: number | null): string {
  return v == null ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 0 });
}

type LinkRow = CampaignAnalytics['links'][number];

const linkColumns: ColumnDef<LinkRow, unknown>[] = [
  {
    accessorKey: 'label',
    header: 'Label',
    cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.label ?? '—'}</span>,
  },
  {
    accessorKey: 'link_type',
    header: 'Type',
    cell: ({ row }) => <Badge variant="gray">{linkTypeLabel(row.original.link_type)}</Badge>,
  },
  {
    accessorKey: 'destination_url',
    header: 'Destination',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-600">{row.original.destination_url}</span>
    ),
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
    cell: ({ row }) => <span className="tabular-nums">{row.original.clicks.toLocaleString()}</span>,
  },
  {
    accessorKey: 'conversions',
    header: 'Conversions',
    cell: ({ row }) => <span className="tabular-nums">{row.original.conversions.toLocaleString()}</span>,
  },
];

export default function Analytics() {
  const reduced = useReducedMotion();
  const broadcastsQuery = useQuery({
    queryKey: ['broadcasts', 'list'],
    queryFn: () => listBroadcasts({ limit: 50 }),
  });
  const campaigns = broadcastsQuery.data?.campaigns ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    if (selectedId === null && campaigns.length) setSelectedId(campaigns[0].id);
  }, [campaigns, selectedId]);

  const analyticsQuery = useQuery({
    queryKey: ['analytics', selectedId],
    queryFn: () => campaignAnalytics(selectedId as number),
    enabled: selectedId !== null,
  });
  const data = analyticsQuery.data;

  const summaryTiles = data
    ? ([
        { icon: Users, tone: 'green', value: data.summary.recipients, label: 'Recipients', helper: 'In the audience' },
        { icon: Send, tone: 'blue', value: data.summary.sent, label: 'Sent', helper: 'Emails dispatched' },
        { icon: CheckCircle2, tone: 'teal', value: data.summary.delivered, label: 'Delivered', helper: `${pct(data.summary.delivery_rate)} delivery rate`, hint: 'delivery-rate' },
        { icon: Target, tone: 'purple', value: data.summary.opened, label: 'Opened', helper: `${pct(data.summary.open_rate)} open rate`, hint: 'open-rate' },
        { icon: MousePointerClick, tone: 'green', value: data.summary.clicked, label: 'Clicked', helper: `${pct(data.summary.click_rate)} click rate`, hint: 'click-rate' },
        { icon: MailX, tone: 'orange', value: data.summary.bounced, label: 'Bounced', helper: "Couldn't be delivered", hint: 'bounce' },
        { icon: AlertTriangle, tone: 'pink', value: data.summary.complained, label: 'Complaints', helper: 'Marked as spam', hint: 'complaint' },
        { icon: UserMinus, tone: 'blue', value: data.summary.unsubscribed, label: 'Unsubscribed', helper: 'Opted out', hint: 'unsubscribe' },
      ] as { icon: typeof Users; tone: MetricTone; value: number; label: string; helper: string; hint?: string }[])
    : [];

  const chartData =
    data?.links.map((l) => ({
      name: l.label || l.destination_url.replace(/^https?:\/\//, '').slice(0, 18),
      clicks: l.clicks,
      conversions: l.conversions,
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Opens, clicks, and signups for each campaign."
        actions={
          campaigns.length ? (
            <Select
              value={selectedId ? String(selectedId) : undefined}
              onValueChange={(v) => setSelectedId(Number(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name ?? `Campaign #${c.id}`} ({c.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <Reveal className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {broadcastsQuery.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(broadcastsQuery.error)}
          </div>
        ) : null}

        {!broadcastsQuery.isLoading && campaigns.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No campaigns to report on yet"
            description="Once you send a campaign, its opens, clicks, and signups show up here."
            showSteps
          />
        ) : null}

        {analyticsQuery.isLoading || (broadcastsQuery.isLoading && campaigns.length === 0) ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[152px] rounded-2xl" />
            ))}
          </div>
        ) : null}

        {analyticsQuery.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(analyticsQuery.error)}
          </div>
        ) : null}

        {data && !analyticsQuery.isLoading ? (
          <>
            {/* Summary */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryTiles.map((t) => (
                <MetricCard
                  key={t.label}
                  icon={t.icon}
                  tone={t.tone}
                  value={<CountUp value={t.value} />}
                  label={t.label}
                  helperText={t.helper}
                  hintTerm={t.hint}
                />
              ))}
            </section>

            {/*
              * Signups, NOT conversions.
              *
              * This block reads `data.conversions`, but that column is stamped
              * at registration — so it counts accounts created, not learners
              * enrolled. It was previously headed "Conversions & ROI", which
              * invited exactly the wrong read: a campaign buying curious
              * signups looked identical to one buying learners. Enrolment
              * figures live in the outcomes section below.
              */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                Signups &amp; cost
                <HelpHint term="conversion" />
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-6">
                  <div className="text-3xl font-bold tracking-tight text-gray-950">
                    <CountUp value={data.conversions.count} />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700">Signups</div>
                  <p className="mt-1 text-xs text-gray-500">Accounts created by people this campaign brought in</p>
                </Card>
                <Card className="p-6">
                  <div className="text-3xl font-bold tracking-tight text-gray-950">{money(data.conversions.cost)}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-700">Campaign cost</div>
                  <p className="mt-1 text-xs text-gray-500">What you spent on this campaign</p>
                </Card>
                <Card className="p-6">
                  <div className="text-3xl font-bold tracking-tight text-gray-950">
                    {money(data.conversions.cost_per_conversion)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700">Cost per signup</div>
                  <p className="mt-1 text-xs text-gray-500">Cost per enrolled learner is below</p>
                </Card>
              </div>
            </section>

            {selectedId !== null ? <CampaignOutcomes campaignId={selectedId} /> : null}

            {/* Per-link breakdown */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                Per-link breakdown — which links performed best
                <HelpHint term="tracked-link" />
              </h2>
              {data.links.length === 0 ? (
                <Card className="px-6 py-10 text-center text-sm text-gray-500">
                  No tracked links on this campaign. Add tracked links to a campaign to compare what each
                  audience clicks.
                </Card>
              ) : (
                <>
                  <Card className="p-6">
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <RTooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                            cursor={{ fill: 'rgba(22,163,74,0.06)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="clicks" name="Clicks" fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={700} />
                          <Bar dataKey="conversions" name="Conversions" fill="#60a5fa" radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={700} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <DataTable columns={linkColumns} data={data.links} />
                </>
              )}
              <p className="text-xs text-gray-400">
                Generated {new Date(data.generated_at).toLocaleString()}.
              </p>
            </section>
          </>
        ) : null}
      </Reveal>
    </>
  );
}
