import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { apiErrorMessage } from '@/api/errors';
import { createBroadcast, deleteBroadcast, listBroadcasts } from '@/api/endpoints/broadcasts';
import { listCategories } from '@/api/endpoints/categories';
import { listTemplates } from '@/api/endpoints/templates';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import StatusBadge from '@/components/StatusBadge';
import Reveal from '@/components/motion/Reveal';
import PageHeader from '@/components/layout/PageHeader';
import { SelectField, TextField, type SelectOption } from '@/components/form/fields';
import { applyApiErrors } from '@/components/form/applyApiErrors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { toast } from '@/lib/toast';
import type { Broadcast } from '@/types';

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

const schema = z.object({
  name: z.string().min(1, 'Give your campaign a name.'),
  marketing_template_id: z.string().min(1, 'Choose a template.'),
  marketing_category_id: z.string().min(1, 'Choose an audience.'),
  from_name: z.string().min(1, 'Add a sender name.'),
  from_email: z.string().email('Enter a valid sender email.'),
  cost: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function Campaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['broadcasts', 'list'],
    queryFn: () => listBroadcasts({ limit: 50 }),
  });
  const campaigns = data?.campaigns ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Broadcast | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: listTemplates,
    enabled: showCreate,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    enabled: showCreate,
  });

  const templateOptions: SelectOption[] = (templatesQuery.data ?? []).map((t) => ({
    value: String(t.id),
    label: t.name,
  }));
  const audienceOptions: SelectOption[] = (categoriesQuery.data ?? []).map((c) => ({
    value: String(c.id),
    label: `${c.name} (${c.audience_type})`,
  }));

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      marketing_template_id: '',
      marketing_category_id: '',
      from_name: 'The Incubator',
      from_email: '',
      cost: '',
    },
  });

  const createMut = useMutation({
    mutationFn: (v: Values) =>
      createBroadcast({
        name: v.name,
        marketing_template_id: Number(v.marketing_template_id),
        marketing_category_id: Number(v.marketing_category_id),
        from_name: v.from_name,
        from_email: v.from_email,
        cost: v.cost ? Number(v.cost) : undefined,
      }),
    onSuccess: (campaign) => {
      toast.success('Campaign draft created');
      setShowCreate(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      navigate(`/campaigns/${campaign.id}`);
    },
    onError: (e) => toast.error(applyApiErrors(e, form.setError)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBroadcast(id),
    onSuccess: () => {
      toast.success('Draft deleted');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
    onError: (e) => toast.error(e),
  });

  const columns: ColumnDef<Broadcast, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.name ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { id: 'template', header: 'Template', accessorFn: (r) => r.template?.name ?? '—' },
    { id: 'audience', header: 'Audience', accessorFn: (r) => r.category?.name ?? '—' },
    { id: 'scheduled', header: 'Scheduled', accessorFn: (r) => formatDateTime(r.scheduled_at) },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/campaigns/${row.original.id}`)}>
            Open
          </Button>
          {row.original.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              data-write onClick={() => setToDelete(row.original)}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="An email you send to an audience, with tracked links and results."
        actions={
          <Button data-tour="new-campaign" data-write onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New campaign
          </Button>
        }
      />

      <Reveal className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(error)}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={campaigns}
          loading={isLoading}
          empty={
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description="A campaign combines an audience and a template into an email you can preview, test, and send."
              action={
                <Button data-write onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  Create your first campaign
                </Button>
              }
              showSteps
            />
          }
        />
      </Reveal>

      {/* New campaign dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Combine an audience and a template. You'll add tracked links and send on the next screen.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <TextField name="name" label="Campaign name" placeholder="e.g. Spring cohort launch" />
              <SelectField
                name="marketing_template_id"
                label="Template"
                placeholder={templatesQuery.isLoading ? 'Loading…' : 'Choose a template'}
                options={templateOptions}
              />
              <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <span>Audience</span>
                <HelpHint term="audience" />
              </div>
              <SelectField
                name="marketing_category_id"
                label="Who receives this"
                placeholder={categoriesQuery.isLoading ? 'Loading…' : 'Choose an audience'}
                options={audienceOptions}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField name="from_name" label="From name" />
                <TextField
                  name="from_email"
                  label="From email"
                  type="email"
                  placeholder="team@incubatorhub.com"
                  hint="The sender address recipients see."
                />
              </div>
              <TextField
                name="cost"
                label="Cost (optional)"
                placeholder="0.00"
                hint="Used to calculate ROI on the analytics page."
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Creating…' : 'Create draft'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete draft?"
        description={toDelete ? `Delete “${toDelete.name}”? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </>
  );
}
