import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Upload, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiErrorMessage } from '@/api/errors';
import {
  createContact,
  deleteContact,
  importContacts,
  importStatus,
  listContacts,
  unsubscribeContact,
} from '@/api/endpoints/contacts';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import StatusBadge from '@/components/StatusBadge';
import Reveal from '@/components/motion/Reveal';
import PageHeader from '@/components/layout/PageHeader';
import { CheckboxField, TextField } from '@/components/form/fields';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/lib/toast';
import type { Contact, ImportSummary } from '@/types';

const LIMIT = 25;
const STATUS_OPTIONS = ['subscribed', 'unsubscribed', 'bounced', 'complained'];

const createSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  name: z.string().optional(),
  consent_marketing: z.boolean(),
  consent_source: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function Contacts() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState<string>('all');
  const [offset, setOffset] = useState(0);

  const filters = {
    q: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    limit: LIMIT,
    offset,
  };

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => listContacts(filters),
  });

  const contacts = data?.contacts ?? [];
  const meta = data?.meta ?? { total: 0, limit: LIMIT, offset, has_more: false };

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['contacts'] });
  }

  // --- Confirm (unsubscribe / delete) ---
  const [confirm, setConfirm] = useState<{ type: 'unsubscribe' | 'delete'; contact: Contact } | null>(
    null,
  );

  const unsubscribeMut = useMutation({
    mutationFn: (id: number) => unsubscribeContact(id),
    onSuccess: () => {
      toast.success('Contact unsubscribed');
      invalidate();
      setConfirm(null);
    },
    onError: (e) => toast.error(e),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      toast.success('Contact deleted');
      invalidate();
      setConfirm(null);
    },
    onError: (e) => toast.error(e),
  });

  // --- Add contact ---
  const [showCreate, setShowCreate] = useState(false);
  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', name: '', consent_marketing: true, consent_source: '' },
  });

  const createMut = useMutation({
    mutationFn: (values: CreateValues) =>
      createContact({
        email: values.email,
        name: values.name || undefined,
        consent_marketing: values.consent_marketing,
        consent_source: values.consent_source || undefined,
      }),
    onSuccess: () => {
      toast.success('Contact added');
      setShowCreate(false);
      createForm.reset({ email: '', name: '', consent_marketing: true, consent_source: '' });
      invalidate();
    },
    onError: (e) => toast.error(applyApiErrors(e, createForm.setError)),
  });

  // --- Import CSV ---
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importConsent, setImportConsent] = useState(true);
  const [importConsentSource, setImportConsentSource] = useState('');
  const [importSource, setImportSource] = useState('');
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  const importMut = useMutation({
    mutationFn: async () => {
      if (!importFile) throw new Error('Choose a CSV file first.');
      const { import_id } = await importContacts({
        file: importFile,
        consent_marketing: importConsent,
        consent_source: importConsentSource,
        source: importSource || undefined,
      });
      // Poll the import status a few times (the sync queue completes fast).
      let summary: ImportSummary | null = null;
      for (let i = 0; i < 6; i++) {
        summary = await importStatus(import_id);
        if (summary.status === 'completed' || summary.status === 'failed') break;
        await new Promise((r) => setTimeout(r, 600));
      }
      return summary;
    },
    onSuccess: (summary) => {
      setImportResult(summary);
      toast.success('Import finished');
      invalidate();
    },
    onError: (e) => toast.error(e),
  });

  const columns = useMemo<ColumnDef<Contact, unknown>[]>(
    () => [
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <span className="font-mono text-xs text-gray-900">{row.original.email}</span>,
      },
      { id: 'name', header: 'Name', accessorFn: (r) => r.name ?? '—' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'consent',
        header: 'Consent',
        accessorFn: (r) => (r.consent_marketing ? 'Yes' : 'No'),
      },
      { id: 'source', header: 'Source', accessorFn: (r) => r.source ?? '—' },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.status === 'subscribed' && (
              <Button
                variant="outline"
                size="sm"
                data-write onClick={() => setConfirm({ type: 'unsubscribe', contact: row.original })}
              >
                Unsubscribe
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              data-write onClick={() => setConfirm({ type: 'delete', contact: row.original })}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="People you can email who aren't app users yet — your leads list."
        actions={
          <>
            <Button variant="outline" data-write onClick={() => { setImportResult(null); setShowImport(true); }}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button data-write onClick={() => setShowCreate(true)}>
              <UserPlus className="h-4 w-4" />
              Add contact
            </Button>
          </>
        }
      />

      <Reveal className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <Input
              className="pl-10"
              placeholder="Search email or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFetching && !isLoading ? <span className="text-xs text-gray-400">Updating…</span> : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(error)}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={contacts}
          loading={isLoading}
          empty={
            <EmptyState
              icon={UserPlus}
              title="No contacts yet"
              description="Add contacts one at a time, or import a CSV of leads to build your list."
              action={
                <Button data-write onClick={() => setShowCreate(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add contact
                </Button>
              }
            />
          }
          pagination={{
            limit: LIMIT,
            offset: meta.offset,
            total: meta.total,
            hasMore: meta.has_more,
            onPageChange: setOffset,
          }}
        />
      </Reveal>

      {/* Add contact dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1">
              Add contact
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              Add one person to your contacts list. Consent
              <HelpHint term="consent" /> is required to email them.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <TextField name="email" label="Email" type="email" placeholder="person@example.com" />
              <TextField name="name" label="Name" placeholder="Optional" />
              <CheckboxField
                name="consent_marketing"
                label="This person agreed to receive marketing email"
                hint="Only email people who have given consent. This keeps you compliant and out of spam folders."
              />
              <TextField
                name="consent_source"
                label="Consent source"
                placeholder="e.g. signup form"
                hint="The lawful basis — where/how they agreed (e.g. 'signup form' or 'partner event')."
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Saving…' : 'Add contact'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import CSV dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Import contacts (CSV)</DialogTitle>
            <DialogDescription>
              Columns: email (required), name, phone, source, consent_marketing, consent_source.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-green-600"
                checked={importConsent}
                onChange={(e) => setImportConsent(e.target.checked)}
              />
              <span>
                <span className="font-medium text-gray-900">Default consent for rows without a value</span>
                <span className="mt-0.5 block text-gray-500">
                  Applied only to rows whose CSV doesn't specify consent.
                </span>
              </span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="consent-source" className="flex items-center gap-1">
                Consent source (lawful basis)
                <HelpHint term="consent" />
              </Label>
              <Input
                id="consent-source"
                className="rounded-xl"
                placeholder="e.g. partner event"
                value={importConsentSource}
                onChange={(e) => setImportConsentSource(e.target.value)}
              />
              <p className="text-xs text-gray-500">Required — where these people agreed to be emailed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-tag">Source tag</Label>
              <Input
                id="source-tag"
                className="rounded-xl"
                placeholder="e.g. partner-event"
                value={importSource}
                onChange={(e) => setImportSource(e.target.value)}
              />
            </div>

            {importResult ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Imported', value: importResult.imported ?? 0 },
                  {
                    label: 'Duplicates',
                    value: (importResult.duplicates_in_file ?? 0) + (importResult.duplicates_existing ?? 0),
                  },
                  { label: 'Suppressed', value: importResult.suppressed ?? 0 },
                  { label: 'Invalid', value: importResult.invalid ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-gray-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-950">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowImport(false)}>
                Close
              </Button>
              <Button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending || !importFile || !importConsentSource}
              >
                {importMut.isPending ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsubscribe / delete confirm */}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.type === 'delete' ? 'Delete contact?' : 'Unsubscribe contact?'}
        description={
          confirm?.type === 'delete'
            ? `Permanently delete ${confirm?.contact.email}? This cannot be undone.`
            : `Stop emailing ${confirm?.contact.email}? They'll be moved to your do-not-email list.`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : 'Unsubscribe'}
        destructive={confirm?.type === 'delete'}
        busy={unsubscribeMut.isPending || deleteMut.isPending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.type === 'delete') deleteMut.mutate(confirm.contact.id);
          else unsubscribeMut.mutate(confirm.contact.id);
        }}
      />
    </>
  );
}
