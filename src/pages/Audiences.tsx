import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Target, Trash2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiErrorMessage } from '@/api/errors';
import {
  createCategory,
  deleteCategory,
  filterOptions,
  listCategories,
  previewCount,
} from '@/api/endpoints/categories';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import Reveal from '@/components/motion/Reveal';
import PageHeader from '@/components/layout/PageHeader';
import { SelectField, TextField, type SelectOption } from '@/components/form/fields';
import { applyApiErrors } from '@/components/form/applyApiErrors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import type { Category, FilterOptions, PreviewCount } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  app_users: 'App users',
  contacts: 'Contacts',
  mixed: 'Both',
};

/** Plain-language description of who an audience targets. */
function describeAudience(c: Category, options?: FilterOptions): string {
  const def = (c.filter_definition ?? {}) as Record<string, string>;
  const parts: string[] = [];
  if (c.audience_type !== 'contacts') {
    if (def.programme_of_interest) parts.push(`interested in ${def.programme_of_interest}`);
    if (def.stage) {
      const stageLabel =
        options?.app_user_stages.find((s) => s.key === def.stage)?.label ?? def.stage;
      parts.push(`at the “${stageLabel}” stage`);
    }
  }
  if (c.audience_type !== 'app_users' && def.source) parts.push(`from “${def.source}”`);
  const base = TYPE_LABEL[c.audience_type] ?? c.audience_type;
  return parts.length ? `${base} ${parts.join(', ')}` : `All ${base.toLowerCase()}`;
}

const schema = z.object({
  name: z.string().min(1, 'Give your audience a name.'),
  audience_type: z.string().min(1),
  description: z.string().optional(),
  stage: z.string().optional(),
  programme_of_interest: z.string().optional(),
  source: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function Audiences() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const optionsQuery = useQuery({ queryKey: ['filterOptions'], queryFn: filterOptions });

  const categories = categoriesQuery.data ?? [];
  const options = optionsQuery.data;

  const [counts, setCounts] = useState<Record<number, PreviewCount>>({});
  const previewMut = useMutation({
    mutationFn: (id: number) => previewCount(id),
    onSuccess: (data, id) => setCounts((prev) => ({ ...prev, [id]: data })),
    onError: (e) => toast.error(e),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      audience_type: 'app_users',
      description: '',
      stage: 'any',
      programme_of_interest: 'any',
      source: '',
    },
  });
  const audienceType = form.watch('audience_type');

  function buildFilterDefinition(v: Values): Record<string, unknown> {
    const def: Record<string, unknown> = {};
    if (v.audience_type !== 'contacts') {
      if (v.stage && v.stage !== 'any') def.stage = v.stage;
      if (v.programme_of_interest && v.programme_of_interest !== 'any')
        def.programme_of_interest = v.programme_of_interest;
    }
    if (v.audience_type !== 'app_users' && v.source) def.source = v.source;
    return def;
  }

  const createMut = useMutation({
    mutationFn: (v: Values) =>
      createCategory({
        name: v.name,
        audience_type: v.audience_type,
        description: v.description || undefined,
        filter_definition: buildFilterDefinition(v),
      }),
    onSuccess: () => {
      toast.success('Audience created');
      setShowCreate(false);
      form.reset({
        name: '',
        audience_type: 'app_users',
        description: '',
        stage: 'any',
        programme_of_interest: 'any',
        source: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => toast.error(applyApiErrors(e, form.setError)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      toast.success('Audience deleted');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => toast.error(e),
  });

  const typeOptions: SelectOption[] = (options?.audience_types ?? ['app_users', 'contacts', 'mixed']).map(
    (t) => ({ value: t, label: TYPE_LABEL[t] ?? t }),
  );
  const stageOptions: SelectOption[] = [
    { value: 'any', label: 'Any stage' },
    ...(options?.app_user_stages ?? []).map((s) => ({ value: s.key, label: s.label })),
  ];
  const programmeOptions: SelectOption[] = [
    { value: 'any', label: 'Any programme' },
    ...(options?.app_user_filters?.programme_of_interest ?? []).map((p) => ({ value: p, label: p })),
  ];

  const loading = categoriesQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Audiences"
        subtitle="Groups of people to send a campaign to, built from filters."
        actions={
          <Button data-tour="new-audience" data-write onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New audience
          </Button>
        }
      />

      <Reveal className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {categoriesQuery.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiErrorMessage(categoriesQuery.error)}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No audiences yet"
            description="An audience is a group of people you send a campaign to, built from filters like journey stage or programme of interest."
            action={
              <Button data-write onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New audience
              </Button>
            }
            showSteps
          />
        ) : (
          <div className="space-y-3">
            {categories.map((c) => {
              const count = counts[c.id];
              const isPreviewing = previewMut.isPending && previewMut.variables === c.id;
              return (
                <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{c.name}</h3>
                      <Badge variant="gray">{TYPE_LABEL[c.audience_type] ?? c.audience_type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{describeAudience(c, options)}</p>
                    {c.description ? <p className="text-xs text-gray-500">{c.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {count ? (
                        <>
                          <div className="flex items-center gap-1 text-lg font-bold text-gray-950">
                            <Users className="h-4 w-4 text-green-600" aria-hidden="true" />
                            {count.count.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {count.breakdown.app_users} app · {count.breakdown.contacts} contacts
                          </div>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => previewMut.mutate(c.id)}
                          disabled={isPreviewing}
                        >
                          {isPreviewing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                          Live count
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${c.name}`}
                      data-write onClick={() => setToDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Reveal>

      {/* New audience dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New audience</DialogTitle>
            <DialogDescription>
              Pick who this audience targets. You can preview the live count after saving.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <TextField name="name" label="Name" placeholder="e.g. LITA-interested leads" />
              <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <span>Audience</span>
                <HelpHint term="audience" />
              </div>
              <SelectField
                name="audience_type"
                label="Who's in this audience?"
                options={typeOptions}
                hint="App users are people already in the platform; contacts are leads you imported."
              />

              {audienceType !== 'contacts' && (
                <>
                  <SelectField name="stage" label="Journey stage (app users)" options={stageOptions} />
                  <SelectField
                    name="programme_of_interest"
                    label="Programme of interest"
                    options={programmeOptions}
                  />
                </>
              )}

              {audienceType !== 'app_users' && (
                <TextField
                  name="source"
                  label="Contact source filter"
                  placeholder="e.g. partner-event"
                  hint="Only include contacts tagged with this source."
                />
              )}

              <TextField name="description" label="Description" placeholder="Optional note for your team" />

              {/* Live plain-language preview of the selection */}
              <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
                {describeAudience(
                  {
                    audience_type: form.watch('audience_type'),
                    filter_definition: buildFilterDefinition(form.watch()),
                  } as Category,
                  options,
                )}
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Saving…' : 'Create audience'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete audience?"
        description={toDelete ? `Delete “${toDelete.name}”? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </>
  );
}
