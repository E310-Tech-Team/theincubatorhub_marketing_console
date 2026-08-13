import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { campaignOutcomes } from '@/api/endpoints/analytics';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { OutcomeStage } from '@/types';

const nf = new Intl.NumberFormat();

function money(v: number | null): string {
  // Null means "no cost recorded" or "nothing reached this stage". Rendering
  // either as 0 would read as "free", which is the worst possible misreading
  // on a screen people use to decide where to spend.
  return v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function StageRow({ stage, isLast }: { stage: OutcomeStage; isLast: boolean }) {
  return (
    <tr className={isLast ? '' : 'border-b border-gray-100'}>
      <th scope="row" className="px-5 py-2.5 text-left font-medium text-gray-900">
        {stage.label}
      </th>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{nf.format(stage.count)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{stage.pct_of_clicks.toFixed(1)}%</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{stage.pct_of_signups.toFixed(1)}%</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900">{money(stage.cost_per)}</td>
    </tr>
  );
}

/**
 * What a campaign's signups actually went on to do.
 *
 * The "Signups & cost" section above this one counts registrations, because
 * `converted_at` is stamped at signup. That makes a campaign bringing 1,000
 * curious signups of whom 200 enrol look identical to one where 800 enrol —
 * while costing four times as much per learner. This section is the correction.
 */
export default function CampaignOutcomes({ campaignId }: { campaignId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign-outcomes', campaignId],
    queryFn: () => campaignOutcomes(campaignId),
  });

  if (error) {
    return (
      <Card className="p-5" role="alert">
        <p className="text-sm font-semibold text-gray-900">Outcomes could not be loaded</p>
        <p className="mt-1 text-sm text-gray-600">
          The signup figures above are still accurate; only the downstream breakdown is missing.
        </p>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const enrolled = data.funnel.find((s) => s.key === 'enrolled');
  const signedUp = data.funnel.find((s) => s.key === 'signed_up');

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">What happened after the signup</h2>

      <Card className="flex gap-3 border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold">Signups are not enrolments</p>
          <p className="mt-1">
            The figures above count accounts created. This section follows those same people through to an
            actual enrolment — which is what the spend should be judged on.
            {signedUp && enrolled && signedUp.count > 0 ? (
              <>
                {' '}
                This campaign turned <strong>{nf.format(signedUp.count)}</strong> signups into{' '}
                <strong>{nf.format(enrolled.count)}</strong> enrolled learners
                {enrolled.cost_per != null ? (
                  <>
                    , at <strong>{money(enrolled.cost_per)}</strong> each
                  </>
                ) : null}
                .
              </>
            ) : null}
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="px-5 py-2 font-medium">Stage</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">People</th>
                <th scope="col" className="px-3 py-2 text-right font-medium" title="Of everyone who clicked a campaign link">
                  % of clicks
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium" title="Of everyone who signed up through this campaign">
                  % of signups
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Cost each</th>
              </tr>
            </thead>
            <tbody>
              {data.funnel.map((stage, i) => (
                <StageRow key={stage.key} stage={stage} isLast={i === data.funnel.length - 1} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-gray-500">
        <strong>% of clicks</strong> measures traffic quality; <strong>% of signups</strong> measures how well
        onboarding converts the people this campaign brought. A campaign can be strong on one and weak on the
        other, and the fix is different in each case. A dash means no cost was recorded, or nobody reached that
        stage.
      </p>
    </section>
  );
}
