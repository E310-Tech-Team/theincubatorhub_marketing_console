import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Link2, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiErrorMessage } from '@/api/errors';
import { listCategories } from '@/api/endpoints/categories';
import { listBroadcasts } from '@/api/endpoints/broadcasts';
import { createLink, deleteLink, listLinks, updateLink } from '@/api/endpoints/links';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import LinkFormFields from '@/components/LinkFormFields';
import LinkAnalyticsSheet from '@/components/LinkAnalyticsSheet';
import PageHeader from '@/components/layout/PageHeader';
import { SelectField, type SelectOption } from '@/components/form/fields';
import { applyApiErrors } from '@/components/form/applyApiErrors';
import { LINK_TYPE_OPTIONS, linkTypeLabel } from '@/content/linkTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast';
import type { TrackedLink } from '@/types';

const schema = z.object({
  destination_url: z.string().url('Enter a full URL (https://…).'),
  link_type: z.string().min(1),
  label: z.string().optional(),
  marketing_campaign_id: z.string().optional(),
  marketing_category_id: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const EMPTY_VALUES: Values = {
  destination_url: '',
  link_type: 'acquisition',
  label: '',
  marketing_campaign_id: 'none',
  marketing_category_id: 'none',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
};

/** Map an existing link back into editable form values. */
function linkToValues(link: TrackedLink): Values {
  return {
    destination_url: link.destination_url,
    link_type: link.link_type,
    label: link.label ?? '',
    marketing_campaign_id: link.marketing_campaign_id ? String(link.marketing_campaign_id) : 'none',
    marketing_category_id: link.marketing_category_id ? String(link.marketing_category_id) : 'none',
    utm_source: link.utm.source ?? '',
    utm_medium: link.utm.medium ?? '',
    utm_campaign: link.utm.campaign ?? '',
  };
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Tracked URL copied');
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

export default function Links() {
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState('all');
  const filters = typeFilter === 'all' ? {} : { link_type: typeFilter };

  const { data, isLoading, error } = useQuery({
    queryKey: ['links', filters],
    queryFn: () => listLinks(filters),
  });
  const links = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TrackedLink | null>(null);
  const [toDelete, setToDelete] = useState<TrackedLink | null>(null);
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  // The create/edit form share one dialog; open when either is active.
  const formOpen = showCreate || editing !== null;

  // Campaign + audience options for the optional association in the create/edit form.
  const campaignsQuery = useQuery({
    queryKey: ['broadcasts', 'list'],
    queryFn: () => listBroadcasts({ limit: 50 }),
    enabled: formOpen,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    enabled: formOpen,
  });
  const campaignOptions: SelectOption[] = [
    { value: 'none', label: 'No campaign (standalone)' },
    ...(campaignsQuery.data?.campaigns ?? []).map((c) => ({
      value: String(c.id),
      label: c.name ?? `Campaign #${c.id}`,
    })),
  ];
  const audienceOptions: SelectOption[] = [
    { value: 'none', label: 'No audience' },
    ...(categoriesQuery.data ?? []).map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  // Build the update payload shape from form values (mirrors createMut's mapping).
  const toPayload = (v: Values) => ({
    destination_url: v.destination_url,
    link_type: v.link_type,
    label: v.label || null,
    marketing_campaign_id:
      v.marketing_campaign_id && v.marketing_campaign_id !== 'none' ? Number(v.marketing_campaign_id) : null,
    marketing_category_id:
      v.marketing_category_id && v.marketing_category_id !== 'none' ? Number(v.marketing_category_id) : null,
    utm_source: v.utm_source || null,
    utm_medium: v.utm_medium || null,
    utm_campaign: v.utm_campaign || null,
  });

  const openCreate = () => {
    form.reset(EMPTY_VALUES);
    setEditing(null);
    setShowCreate(true);
  };
  const openEdit = (link: TrackedLink) => {
    form.reset(linkToValues(link));
    setShowCreate(false);
    setEditing(link);
  };
  const closeForm = () => {
    setShowCreate(false);
    setEditing(null);
    form.reset(EMPTY_VALUES);
  };

  const createMut = useMutation({
    mutationFn: (v: Values) =>
      createLink({
        destination_url: v.destination_url,
        link_type: v.link_type,
        label: v.label || undefined,
        marketing_campaign_id:
          v.marketing_campaign_id && v.marketing_campaign_id !== 'none'
            ? Number(v.marketing_campaign_id)
            : undefined,
        marketing_category_id:
          v.marketing_category_id && v.marketing_category_id !== 'none'
            ? Number(v.marketing_category_id)
            : undefined,
        utm_source: v.utm_source || undefined,
        utm_medium: v.utm_medium || undefined,
        utm_campaign: v.utm_campaign || undefined,
      }),
    onSuccess: () => {
      toast.success('Tracked link created');
      setShowCreate(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    },
    onError: (e) => toast.error(applyApiErrors(e, form.setError)),
  });

  const updateMut = useMutation({
    mutationFn: (v: Values) => {
      if (!editing) throw new Error('No link selected');
      return updateLink(editing.id, toPayload(v));
    },
    onSuccess: () => {
      toast.success('Tracked link updated');
      closeForm();
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    },
    onError: (e) => toast.error(applyApiErrors(e, form.setError)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteLink(id),
    onSuccess: () => {
      toast.success('Link deleted');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    },
    onError: (e) => toast.error(e),
  });

  const columns = useMemo<ColumnDef<TrackedLink, unknown>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Label',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">{row.original.label ?? '—'}</span>
        ),
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
          <span className="block max-w-[16rem] truncate font-mono text-xs text-gray-600">
            {row.original.destination_url}
          </span>
        ),
      },
      {
        id: 'tracked_url',
        header: 'Tracked URL',
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => copy(row.original.tracked_url)}
            className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg px-1.5 py-0.5 font-mono text-xs text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Copy tracked URL"
          >
            <span className="truncate">{row.original.tracked_url}</span>
            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </button>
        ),
      },
      {
        accessorKey: 'click_count',
        header: 'Clicks',
        cell: ({ row }) => <span className="tabular-nums">{row.original.click_count.toLocaleString()}</span>,
      },
      {
        id: 'conversions',
        header: 'Conversions',
        accessorFn: (r) => r.conversions ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums">{(row.original.conversions ?? 0).toLocaleString()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Copy tracked URL" onClick={() => copy(row.original.tracked_url)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="View analytics" onClick={() => setAnalyticsId(row.original.id)}>
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit link" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
              aria-label="Delete link"
              onClick={() => setToDelete(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  // Live preview of the destination with UTM appended (mirrors what the redirect does).
  const watch = form.watch();
  const previewUrl = useMemo(() => {
    if (!watch.destination_url) return '';
    try {
      const u = new URL(watch.destination_url);
      const map: Record<string, string | undefined> = {
        utm_source: watch.utm_source,
        utm_medium: watch.utm_medium,
        utm_campaign: watch.utm_campaign,
      };
      for (const [k, v] of Object.entries(map)) if (v) u.searchParams.set(k, v);
      return u.toString();
    } catch {
      return watch.destination_url;
    }
  }, [watch.destination_url, watch.utm_source, watch.utm_medium, watch.utm_campaign]);

  return (
    <>
      <PageHeader
        title="Tracked links"
        subtitle="Generate a link for any channel — clicks and signups are still counted."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New link
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {LINK_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            Paste a tracked URL into any email, SMS, post, or QR code
            <HelpHint term="tracked-link" />
          </span>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(error)}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={links}
          loading={isLoading}
          empty={
            <EmptyState
              icon={Link2}
              title="No tracked links yet"
              description="Generate a link, paste it into any email, SMS, post, or QR code, and we'll still track clicks and signups — no campaign required."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  New link
                </Button>
              }
            />
          }
        />
      </div>

      {/* Create / edit link dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit tracked link' : 'New tracked link'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the destination, label, campaign/audience, or UTM tags. The short URL stays the same.'
                : 'Works standalone — no campaign needed. Share it anywhere and the clicks come back here.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => (editing ? updateMut : createMut).mutate(v))}
              className="space-y-4"
            >
              <LinkFormFields />
              <SelectField
                name="marketing_campaign_id"
                label="Attach to campaign (optional)"
                options={campaignOptions}
              />
              <SelectField
                name="marketing_category_id"
                label="Attach to audience (optional)"
                options={audienceOptions}
              />
              {previewUrl ? (
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-xs font-medium text-gray-500">Destination preview (with UTM)</div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-700">{previewUrl}</div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {editing
                    ? updateMut.isPending
                      ? 'Saving…'
                      : 'Save changes'
                    : createMut.isPending
                      ? 'Creating…'
                      : 'Create link'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <LinkAnalyticsSheet
        linkId={analyticsId}
        link={links.find((l) => l.id === analyticsId) ?? null}
        onOpenChange={(open) => !open && setAnalyticsId(null)}
        onCopy={copy}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete tracked link?"
        description={
          toDelete
            ? `Delete "${toDelete.label ?? toDelete.destination_url}"? Existing click history is removed and the short URL stops working.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </>
  );
}
