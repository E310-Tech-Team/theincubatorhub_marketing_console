import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Eye, Mail, Plus } from 'lucide-react';
import { apiErrorMessage } from '@/api/errors';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  previewTemplate,
  updateTemplate,
} from '@/api/endpoints/templates';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import HelpHint from '@/components/HelpHint';
import Reveal from '@/components/motion/Reveal';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import type { RenderedPreview, Template } from '@/types';

// Literal placeholder hint (kept as a string so JSX doesn't interpret the braces).
const PLACEHOLDER_HINT = '{{ first_name }}, {{ name }}, {{ email }}';

interface EditorState {
  id: number; // 0 = new
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
}

const EMPTY_EDITOR: EditorState = {
  id: 0,
  name: '',
  subject: '',
  html_body: '<p>Hi {{ first_name }},</p>\n<p></p>',
  text_body: '',
};

export default function Templates() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['templates'], queryFn: listTemplates });
  const templates = data ?? [];

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [preview, setPreview] = useState<RenderedPreview | null>(null);
  const [toDelete, setToDelete] = useState<Template | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['templates'] });
  }

  const previewMut = useMutation({
    mutationFn: () =>
      previewTemplate({
        subject: editor?.subject,
        html_body: editor?.html_body,
        text_body: editor?.text_body || undefined,
      }),
    onSuccess: (p) => setPreview(p),
    onError: (e) => toast.error(e),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editor) throw new Error('No template open.');
      if (editor.id) {
        return updateTemplate(editor.id, {
          name: editor.name,
          subject: editor.subject,
          html_body: editor.html_body,
          text_body: editor.text_body || null,
        });
      }
      return createTemplate({
        name: editor.name,
        subject: editor.subject,
        html_body: editor.html_body,
        text_body: editor.text_body || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Template saved');
      setEditor(null);
      setPreview(null);
      invalidate();
    },
    onError: (e) => toast.error(e),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      setToDelete(null);
      invalidate();
    },
    onError: (e) => toast.error(e),
  });

  const columns: ColumnDef<Template, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.name}</span>,
    },
    { accessorKey: 'subject', header: 'Subject' },
    {
      id: 'variables',
      header: 'Placeholders',
      accessorFn: (r) => (r.variables?.length ? r.variables.join(', ') : '—'),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-500">
          {row.original.variables?.length ? row.original.variables.join(', ') : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const t = row.original;
              setEditor({
                id: t.id,
                name: t.name,
                subject: t.subject,
                html_body: t.html_body ?? '',
                text_body: t.text_body ?? '',
              });
              setPreview(null);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            data-write onClick={() => setToDelete(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // --- Editor view ---
  if (editor) {
    const update = (patch: Partial<EditorState>) => setEditor((e) => (e ? { ...e, ...patch } : e));
    return (
      <>
        <PageHeader
          title={editor.id ? 'Edit template' : 'New template'}
          subtitle="Reusable email designs with placeholders like the person's name."
          actions={
            <Button variant="outline" onClick={() => { setEditor(null); setPreview(null); }}>
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </Button>
          }
        />
        <div className="grid grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
          {/* Editor form */}
          <Card className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                className="rounded-xl"
                value={editor.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. Spring launch"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">Subject</Label>
              <Input
                id="t-subject"
                className="rounded-xl"
                value={editor.subject}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder="Subject line recipients see"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-html">HTML body</Label>
              <Textarea
                id="t-html"
                rows={10}
                className="rounded-xl font-mono text-xs focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-100"
                value={editor.html_body}
                onChange={(e) => update({ html_body: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-text">Text body (optional)</Label>
              <Textarea
                id="t-text"
                rows={4}
                className="rounded-xl font-mono text-xs focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-100"
                value={editor.text_body}
                onChange={(e) => update({ text_body: e.target.value })}
              />
            </div>
            <p className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
              Placeholders <HelpHint term="template" />:{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">{PLACEHOLDER_HINT}</code> — these fill in
              each person's details when the email is sent. Values are HTML-escaped.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" data-write onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
                <Eye className="h-4 w-4" />
                {previewMut.isPending ? 'Rendering…' : 'Preview'}
              </Button>
              <Button data-write onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editor.name}>
                {saveMut.isPending ? 'Saving…' : 'Save template'}
              </Button>
            </div>
          </Card>

          {/* Live preview */}
          <Card className="p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Preview (sample recipient)
            </div>
            {preview ? (
              <div>
                <div className="text-xs text-gray-500">Subject</div>
                <div className="mb-3 font-semibold text-gray-900">{preview.subject}</div>
                <hr className="mb-3 border-gray-200" />
                {/* Server-sanitised HTML from previewTemplate. */}
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">Click Preview to render the email with sample data.</p>
            )}
          </Card>
        </div>
      </>
    );
  }

  // --- List view ---
  return (
    <>
      <PageHeader
        title="Email templates"
        subtitle="Reusable email designs with placeholders like the person's name."
        actions={
          <Button data-tour="new-template" data-write onClick={() => { setEditor({ ...EMPTY_EDITOR }); setPreview(null); }}>
            <Plus className="h-4 w-4" />
            New template
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
          data={templates}
          loading={isLoading}
          empty={
            <EmptyState
              icon={Mail}
              title="No templates yet"
              description="A template is the email you write once; placeholders fill in each person's details at send time."
              action={
                <Button data-write onClick={() => { setEditor({ ...EMPTY_EDITOR }); setPreview(null); }}>
                  <Plus className="h-4 w-4" />
                  New template
                </Button>
              }
            />
          }
        />
      </Reveal>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete template?"
        description={toDelete ? `Delete “${toDelete.name}”? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </>
  );
}
