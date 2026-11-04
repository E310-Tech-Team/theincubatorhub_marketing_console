import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  Link2,
  Loader2,
  PauseCircle,
  Plus,
  SendHorizonal,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { apiErrorMessage } from '@/api/errors';
import {
  getBroadcast,
  pauseBroadcast,
  previewBroadcast,
  scheduleBroadcast,
  sendBroadcast,
  testSendBroadcast,
} from '@/api/endpoints/broadcasts';
import { createLink, deleteLink, listLinks } from '@/api/endpoints/links';
import ConfirmDialog from '@/components/ConfirmDialog';
import HelpHint from '@/components/HelpHint';
import LinkFormFields from '@/components/LinkFormFields';
import StatusBadge from '@/components/StatusBadge';
import SuccessCelebration from '@/components/motion/SuccessCelebration';
import PageHeader from '@/components/layout/PageHeader';
import { Flip, gsap, useGSAP } from '@/lib/gsap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { applyApiErrors } from '@/components/form/applyApiErrors';
import { linkTypeLabel } from '@/content/linkTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import type { RenderedPreview } from '@/types';

const linkSchema = z.object({
  destination_url: z.string().url('Enter a full URL (https://…).'),
  link_type: z.string().min(1),
  label: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});
type LinkValues = z.infer<typeof linkSchema>;

type CampaignPreview = RenderedPreview & { from: { name: string | null; email: string | null } };

export default function CampaignDetail() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignQuery = useQuery({
    queryKey: ['broadcast', id],
    queryFn: () => getBroadcast(id),
    enabled: Number.isFinite(id),
  });
  const linksQuery = useQuery({
    queryKey: ['links', id],
    queryFn: () => listLinks({ marketing_campaign_id: id }),
    enabled: Number.isFinite(id),
  });

  const campaign = campaignQuery.data;
  const links = linksQuery.data ?? [];

  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [cueOpen, setCueOpen] = useState(false);

  // GSAP Flip for the tracked-links list (add/remove ease in/out).
  const reduced = useReducedMotion();
  const linksFlipRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  function captureLinksFlip() {
    if (reduced) return;
    linksFlipRef.current = Flip.getState('[data-flip-link]');
  }
  useGSAP(
    () => {
      if (!linksFlipRef.current || reduced) return;
      Flip.from(linksFlipRef.current, {
        duration: 0.4,
        ease: 'power2.out',
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.3 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.96, duration: 0.2 }),
      });
      linksFlipRef.current = null;
    },
    { dependencies: [links] },
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['broadcast', id] });
    void queryClient.invalidateQueries({ queryKey: ['links', id] });
    void queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
  }

  // --- Tracked links ---
  const linkForm = useForm<LinkValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      destination_url: '',
      link_type: 'reengagement',
      label: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
    },
  });

  const addLinkMut = useMutation({
    mutationFn: (v: LinkValues) =>
      createLink({
        destination_url: v.destination_url,
        link_type: v.link_type,
        label: v.label || undefined,
        marketing_campaign_id: id,
        marketing_category_id: campaign?.category.id ?? undefined,
        utm_source: v.utm_source || undefined,
        utm_medium: v.utm_medium || undefined,
        utm_campaign: v.utm_campaign || undefined,
      }),
    onSuccess: () => {
      toast.success('Tracked link added');
      linkForm.reset({
        destination_url: '',
        link_type: 'reengagement',
        label: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['links', id] });
    },
    onError: (e) => toast.error(applyApiErrors(e, linkForm.setError)),
  });

  const deleteLinkMut = useMutation({
    mutationFn: (linkId: number) => deleteLink(linkId),
    onSuccess: () => {
      toast.success('Link removed');
      void queryClient.invalidateQueries({ queryKey: ['links', id] });
    },
    onError: (e) => toast.error(e),
  });

  // --- Actions ---
  const previewMut = useMutation({
    mutationFn: () => previewBroadcast(id),
    onSuccess: (p) => setPreview(p),
    onError: (e) => toast.error(e),
  });
  const testSendMut = useMutation({
    mutationFn: () => testSendBroadcast(id),
    onSuccess: ({ sent_to }) => {
      toast.success('Test email sent', `Sent to ${sent_to}`);
      setCueOpen(true);
    },
    onError: (e) => toast.error(e),
  });
  const scheduleMut = useMutation({
    mutationFn: () => scheduleBroadcast(id, new Date(scheduleAt).toISOString()),
    onSuccess: () => {
      toast.success('Campaign scheduled');
      refresh();
    },
    onError: (e) => toast.error(e),
  });
  const sendMut = useMutation({
    mutationFn: () => sendBroadcast(id),
    onSuccess: () => {
      toast.success('Campaign send dispatched');
      setConfirmSend(false);
      setCueOpen(true);
      refresh();
    },
    onError: (e) => toast.error(e),
  });
  const pauseMut = useMutation({
    mutationFn: () => pauseBroadcast(id),
    onSuccess: () => {
      toast.success('Campaign paused');
      refresh();
    },
    onError: (e) => toast.error(e),
  });

  if (campaignQuery.isLoading) {
    return (
      <>
        <PageHeader title="Campaign" subtitle="Loading campaign…" />
        <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </>
    );
  }

  if (campaignQuery.error || !campaign) {
    return (
      <>
        <PageHeader title="Campaign" subtitle="We couldn't load this campaign." />
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {campaignQuery.error ? apiErrorMessage(campaignQuery.error) : 'Campaign not found.'}
          </div>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
            Back to campaigns
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={campaign.name ?? 'Campaign'}
        subtitle={`From ${campaign.from.name ?? '—'} <${campaign.from.email ?? '—'}> · Subject: ${campaign.subject}`}
        actions={
          <>
            <StatusBadge status={campaign.status} />
            <Button variant="outline" onClick={() => navigate('/campaigns')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Tracked links */}
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">Tracked links</h2>
            <HelpHint term="tracked-link" />
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Tracked links let you see what each audience clicks. Links inside the template are
            auto-tracked at send — add extra ones here.
          </p>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Label', 'Type', 'Destination', 'Tracked URL', 'Clicks', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linksQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <Skeleton className="h-4 w-48" />
                    </td>
                  </tr>
                ) : links.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      No tracked links yet. Links inside the template are auto-tracked at send.
                    </td>
                  </tr>
                ) : (
                  links.map((l) => (
                    <tr key={l.id} data-flip-link className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-700">{l.label ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="gray">{linkTypeLabel(l.link_type)}</Badge>
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-gray-600">
                        {l.destination_url}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-gray-600">
                        {l.tracked_url}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-900">{l.click_count}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          data-write aria-label="Remove link"
                          onClick={() => {
                            captureLinksFlip();
                            deleteLinkMut.mutate(l.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add link */}
          <Form {...linkForm}>
            <form
              data-write onSubmit={linkForm.handleSubmit((v) => {
                captureLinksFlip();
                addLinkMut.mutate(v);
              })}
              className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <LinkFormFields />
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" data-tour="add-link" disabled={addLinkMut.isPending}>
                  <Plus className="h-4 w-4" />
                  {addLinkMut.isPending ? 'Adding…' : 'Add link'}
                </Button>
              </div>
            </form>
          </Form>
        </Card>

        {/* Actions toolbar */}
        <Card className="p-6" data-tour="preview-actions">
          <h2 className="mb-4 flex items-center gap-1 text-sm font-semibold text-gray-900">
            Preview &amp; send
            <HelpHint term="test-send" />
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
              <Eye className="h-4 w-4" />
              {previewMut.isPending ? 'Rendering…' : 'Preview'}
            </Button>
            <Button variant="outline" data-write onClick={() => testSendMut.mutate()} disabled={testSendMut.isPending}>
              {testSendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Test-send to me
            </Button>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="schedule-at" className="text-xs text-gray-500">
                  Schedule for
                </Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  className="rounded-xl"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
              <Button variant="outline" data-write onClick={() => scheduleMut.mutate()} disabled={!scheduleAt || scheduleMut.isPending}>
                <CalendarClock className="h-4 w-4" />
                Schedule
              </Button>
            </div>
            <Button data-write onClick={() => setConfirmSend(true)} disabled={sendMut.isPending}>
              <SendHorizonal className="h-4 w-4" />
              Send now
            </Button>
            <Button variant="outline" data-write onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
              <PauseCircle className="h-4 w-4" />
              Pause
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Always preview and send a test to yourself before sending to your audience.
          </p>
        </Card>

        {/* Preview pane */}
        {preview ? (
          <Card className="p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</div>
            <div className="text-xs text-gray-500">Subject</div>
            <div className="mb-3 font-semibold text-gray-900">{preview.subject}</div>
            <hr className="mb-3 border-gray-200" />
            {/* Server-sanitised HTML from previewBroadcast. */}
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </Card>
        ) : null}

        <div>
          <Link to="/campaigns" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            ← Back to all campaigns
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this campaign now?"
        description="This sends the email to the full audience immediately. This can't be undone."
        confirmLabel="Send now"
        busy={sendMut.isPending}
        onConfirm={() => sendMut.mutate()}
      />

      <SuccessCelebration open={cueOpen} onDone={() => setCueOpen(false)} />
    </>
  );
}
