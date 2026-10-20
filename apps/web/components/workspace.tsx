'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type {
  ApiResponse,
  AuditRecord,
  Invitation,
  Member,
  OrganizationMembership,
  Project,
  Task,
  User
} from '@repo/types';
import { LanguageSwitcher, useLocale } from './locale-provider';
import { api } from '@/lib/api';
import { localizeError } from '@/lib/localize-error';
import { formatDate } from '@toolkit/i18n';
import type { MessageKey } from '@/lib/messages';

type Tab = 'projects' | 'members' | 'audit' | 'settings';
const projectStages = [
  { id: 'PLANNED', label: 'Planned' },
  { id: 'ACTIVE', label: 'In progress' },
  { id: 'DONE', label: 'Completed' }
] as const;
const taskStages = [
  { id: 'TODO', label: 'To do' },
  { id: 'ACTIVE', label: 'In progress' },
  { id: 'DONE', label: 'Completed' }
] as const;
const roleLabels = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  MEMBER: 'Member',
  VIEWER: 'Read only'
} as const;
const actionLabels: Record<string, MessageKey> = {
  'organization.created': 'Organization created',
  'organization.updated': 'Organization updated',
  'organization.owner_transferred': 'Ownership transferred',
  'invitation.created': 'Invitation created',
  'invitation.accepted': 'Invitation accepted',
  'invitation.revoked': 'Invitation revoked',
  'member.role_changed': 'Member role changed',
  'member.removed': 'Member removed',
  'project.created': 'Project created',
  'project.updated': 'Project updated',
  'project.deleted': 'Project deleted',
  'task.created': 'Task created',
  'task.updated': 'Task updated',
  'task.deleted': 'Task deleted',
  'comment.created': 'Comment added',
  'comment.deleted': 'Comment deleted'
};
export function Workspace() {
  const { t, locale } = useLocale();
  const [user, setUser] = useState<User | null>(null),
    [initializing, setInitializing] = useState(true),
    [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]),
    [selected, setSelected] = useState('');
  const [projects, setProjects] = useState<Project[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [invitations, setInvitations] = useState<Invitation[]>([]),
    [logs, setLogs] = useState<AuditRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]),
    [currentProject, setCurrentProject] = useState<string | null>(null),
    [tab, setTab] = useState<Tab>('projects');
  const [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState<MessageKey | null>(null),
    [invite, setInvite] = useState(''),
    [invitationLink, setInvitationLink] = useState(''),
    [search, setSearch] = useState('');
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const membership = organizations.find((o) => o.organizationId === selected),
    role = membership?.role;
  const manager = role === 'OWNER' || role === 'ADMIN',
    writer = !!role && role !== 'VIEWER';
  const activeProject = projects.find((p) => p.id === currentProject);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const clearOrganizationData = useCallback(() => {
    invalidate();
    setProjects([]);
    setMembers([]);
    setTasks([]);
    setLogs([]);
    setInvitations([]);
    setInvitationLink('');
    setCurrentProject(null);
    setTab('projects');
    setError(null);
  }, [invalidate]);
  const orgPath = '/organizations/' + selected;
  const loadOrganizations = useCallback(
    async (preferred?: string) => {
      const { data } = await api<ApiResponse<OrganizationMembership[]>>('/organizations');
      if (preferred) clearOrganizationData();
      setOrganizations(data);
      setSelected((previous) =>
        data.some((m) => m.organizationId === (preferred ?? previous))
          ? (preferred ?? previous)
          : (data[0]?.organizationId ?? '')
      );
      return data;
    },
    [clearOrganizationData]
  );
  useEffect(() => {
    const readInvitation = () => {
      const match = window.location.hash.match(/^#invite=([a-f0-9]{64})$/);
      setInvite(match?.[1] ?? '');
    };
    readInvitation();
    window.addEventListener('hashchange', readInvitation);
    return () => window.removeEventListener('hashchange', readInvitation);
  }, []);
  useEffect(() => {
    let active = true;
    api<ApiResponse<User>>('/auth/me')
      .then(async ({ data }) => {
        if (active) {
          setUser(data);
          await loadOrganizations();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [loadOrganizations]);
  const refresh = useCallback(async () => {
    if (!selected) return;
    const version = ++generation.current;
    const [p, m] = await Promise.all([
      api<ApiResponse<Project[]>>('/organizations/' + selected + '/projects'),
      api<ApiResponse<Member[]>>('/organizations/' + selected + '/members')
    ]);
    if (version !== generation.current) return;
    setProjects(p.data);
    setMembers(m.data);
    const own = m.data.find((x) => x.userId === user?.id);
    setOrganizations((items) =>
      items.map((x) => (x.organizationId === selected && own ? { ...x, role: own.role } : x))
    );
  }, [selected, user?.id]);
  useEffect(() => {
    setProjects([]);
    setMembers([]);
    setTasks([]);
    setLogs([]);
    setInvitations([]);
    setCurrentProject(null);
    setInvitationLink('');
    setTab('projects');
    setError(null);
    if (selected) refresh().catch(setError);
    return invalidate;
  }, [selected, refresh, invalidate]);
  useEffect(() => {
    let active = true;
    setTasks([]);
    if (selected && currentProject)
      api<ApiResponse<Task[]>>(orgPath + '/projects/' + currentProject + '/tasks')
        .then((r) => {
          if (active) setTasks(r.data);
        })
        .catch((e) => {
          if (active) setError(e);
        });
    return () => {
      active = false;
    };
  }, [selected, currentProject, orgPath]);
  async function execute(work: () => Promise<void>, success: MessageKey = 'Changes saved') {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      setNotice(success);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await execute(async () => {
      const payload = {
        email: String(form.get('email')),
        password: String(form.get('password')),
        ...(mode === 'register' ? { name: String(form.get('name')) } : {})
      };
      const { data } = await api<ApiResponse<User>>('/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setUser(data);
      await loadOrganizations();
    }, 'Welcome to your workspace');
  }
  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name'));
    await execute(async () => {
      const { data } = await api<ApiResponse<{ id: string }>>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      await loadOrganizations(data.id);
      setCreatingOrganization(false);
      form.reset();
    }, 'Organization created');
  }
  async function openTab(next: Tab) {
    setTab(next);
    setError(null);
    if (next === 'audit')
      await execute(async () => {
        setLogs((await api<ApiResponse<AuditRecord[]>>(orgPath + '/audit')).data);
      });
    if (next === 'members' && manager)
      await execute(async () => {
        setInvitations((await api<ApiResponse<Invitation[]>>(orgPath + '/invitations')).data);
      });
  }
  async function reloadTasks() {
    if (currentProject)
      setTasks(
        (await api<ApiResponse<Task[]>>(orgPath + '/projects/' + currentProject + '/tasks')).data
      );
  }
  function date(value: string) {
    return formatDate(value, locale, { dateStyle: 'medium' });
  }
  return (
    <div className="saas-shell">
      <header className="saas-header">
        <Link href="/" className="saas-brand">
          ◫ {t('Workspace')}
        </Link>
        <nav aria-label={t('Main navigation')}>
          <Link href="/help">{t('Help')}</Link>
          <LanguageSwitcher />
          {user && selected && (
            <button disabled={busy} onClick={() => setCreatingOrganization((value) => !value)}>
              {t('New organization')}
            </button>
          )}
          {user && (
            <button
              disabled={busy}
              onClick={() =>
                execute(async () => {
                  await api('/auth/logout', { method: 'POST' });
                  generation.current++;
                  setUser(null);
                  setOrganizations([]);
                  setSelected('');
                  setProjects([]);
                  setMembers([]);
                  setTasks([]);
                  setLogs([]);
                  setInvitations([]);
                  setCurrentProject(null);
                }, 'Signed out')
              }
            >
              {t('Sign out')}
            </button>
          )}
        </nav>
      </header>
      <main className="saas-main">
        <div role="alert" className={error ? 'saas-alert' : 'sr-only'}>
          {error ? localizeError(error, locale) : ''}
        </div>
        <div role="status" aria-live="polite" className={notice ? 'saas-notice' : 'sr-only'}>
          {notice ? t(notice) : ''}
        </div>
        {initializing ? (
          <p>{t('Loading…')}</p>
        ) : !user ? (
          <section className="saas-auth">
            <div>
              <p className="saas-eyebrow">{t('TEAM WORKSPACE')}</p>
              <h1>{t('One team. A clearer way forward.')}</h1>
              <p>{t('Organize projects, share tasks and keep every company separate.')}</p>
            </div>
            <form onSubmit={authenticate}>
              <h2>{mode === 'register' ? t('Create account') : t('Sign in')}</h2>
              {invite && <p>{t('Sign in with the invited email to join your team.')}</p>}
              <div className="saas-tabs">
                <button
                  type="button"
                  aria-pressed={mode === 'register'}
                  onClick={() => setMode('register')}
                >
                  {t('Create account')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'login'}
                  onClick={() => setMode('login')}
                >
                  {t('Sign in')}
                </button>
              </div>
              {mode === 'register' && (
                <label>
                  {t('Your name')}
                  <input name="name" required maxLength={80} autoComplete="name" />
                </label>
              )}
              <label>
                {t('Email address')}
                <input name="email" type="email" required autoComplete="email" maxLength={254} />
              </label>
              <label>
                {t('Password')}
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </label>
              <small>{t('Use at least 12 characters.')}</small>
              <button className="saas-primary" disabled={busy}>
                {busy ? t('Saving…') : mode === 'register' ? t('Create account') : t('Sign in')}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="saas-workspace-heading">
              <div>
                <p className="saas-eyebrow">{t('TEAM WORKSPACE')}</p>
                <h1>{membership?.organization.name ?? t('Create your organization')}</h1>
                <p>
                  {user.name} · {user.email}
                  {role && (
                    <>
                      {' '}
                      · <strong>{t(roleLabels[role])}</strong>
                    </>
                  )}
                </p>
              </div>
              {organizations.length > 0 && (
                <label>
                  {t('Organization')}
                  <select
                    aria-label={t('Organization')}
                    value={selected}
                    disabled={busy}
                    onChange={(e) => {
                      clearOrganizationData();
                      setSelected(e.target.value);
                    }}
                  >
                    {organizations.map((m) => (
                      <option key={m.organizationId} value={m.organizationId}>
                        {m.organization.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {creatingOrganization && selected && (
              <section className="saas-panel">
                <h2>{t('Create another organization')}</h2>
                <form className="saas-inline" onSubmit={createOrganization}>
                  <label>
                    {t('New organization name')}
                    <input name="name" required maxLength={100} />
                  </label>
                  <button disabled={busy}>{t('Create organization')}</button>
                </form>
              </section>
            )}
            {invite && (
              <section className="saas-panel">
                <h2>{t('Join your team')}</h2>
                <p>{t('This invitation is bound to your email and can be used once.')}</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    execute(async () => {
                      const { data } = await api<ApiResponse<{ organizationId: string }>>(
                        '/invitations/accept',
                        { method: 'POST', body: JSON.stringify({ token: invite }) }
                      );
                      setInvite('');
                      history.replaceState(null, '', '/');
                      await loadOrganizations(data.organizationId);
                    }, 'Invitation accepted')
                  }
                >
                  {t('Accept invitation')}
                </button>
              </section>
            )}
            {!selected ? (
              <section className="saas-panel">
                <h2>{t('Start with your team')}</h2>
                <p>{t('Create a company workspace or accept an invitation above.')}</p>
                <form className="saas-inline" onSubmit={createOrganization}>
                  <label>
                    {t('Organization name')}
                    <input name="name" required maxLength={100} />
                  </label>
                  <button disabled={busy}>{t('Create organization')}</button>
                </form>
              </section>
            ) : (
              <>
                <nav className="saas-nav" aria-label={t('Workspace navigation')}>
                  {(
                    ['projects', 'members', ...(manager ? ['audit', 'settings'] : [])] as Tab[]
                  ).map((item) => (
                    <button
                      key={item}
                      aria-current={tab === item ? 'page' : undefined}
                      disabled={busy}
                      onClick={() => openTab(item)}
                    >
                      {t(
                        (
                          {
                            projects: 'Projects',
                            members: 'Members',
                            audit: 'Audit log',
                            settings: 'Settings'
                          } as const
                        )[item]
                      )}
                    </button>
                  ))}
                  <button
                    className="saas-refresh"
                    disabled={busy}
                    onClick={() =>
                      execute(async () => {
                        const fresh = await loadOrganizations();
                        if (!fresh.some((item) => item.organizationId === selected)) {
                          clearOrganizationData();
                          return;
                        }
                        await refresh();
                        if (currentProject) await reloadTasks();
                      })
                    }
                  >
                    {t('Refresh')}
                  </button>
                </nav>
                {tab === 'projects' && (
                  <section>
                    <div className="saas-section-heading">
                      <h2>{t('Projects')}</h2>
                      <label className="saas-search">
                        <span className="sr-only">{t('Search projects')}</span>
                        <input
                          aria-label={t('Search projects')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t('Search projects')}
                        />
                      </label>
                    </div>
                    {writer && (
                      <form
                        className="saas-inline saas-panel"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const title = String(new FormData(form).get('title'));
                          void execute(async () => {
                            await api(orgPath + '/projects', {
                              method: 'POST',
                              body: JSON.stringify({ title })
                            });
                            form.reset();
                            await refresh();
                          }, 'Project created');
                        }}
                      >
                        <label>
                          {t('Project title')}
                          <input name="title" required maxLength={120} />
                        </label>
                        <button disabled={busy}>{t('Create project')}</button>
                      </form>
                    )}
                    <div className="saas-board">
                      {projectStages.map((stage) => (
                        <section key={stage.id} className="saas-column" aria-label={t(stage.label)}>
                          <h3>
                            {t(stage.label)}{' '}
                            <span>{projects.filter((p) => p.status === stage.id).length}</span>
                          </h3>
                          {projects
                            .filter(
                              (p) =>
                                p.status === stage.id &&
                                (p.title + ' ' + p.description)
                                  .toLowerCase()
                                  .includes(search.toLowerCase())
                            )
                            .map((p) => (
                              <button
                                className={
                                  'saas-card' + (p.id === currentProject ? ' selected' : '')
                                }
                                key={p.id}
                                onClick={() => setCurrentProject(p.id)}
                              >
                                <strong>{p.title}</strong>
                                <p>{p.description || t('No description')}</p>
                                <small>{date(p.updatedAt)}</small>
                              </button>
                            ))}
                        </section>
                      ))}
                    </div>
                    {activeProject && (
                      <section
                        className="saas-panel saas-project-detail"
                        aria-label={t('Project details')}
                      >
                        <div className="saas-section-heading">
                          <h2>{activeProject.title}</h2>
                          <button onClick={() => setCurrentProject(null)}>{t('Close')}</button>
                        </div>
                        <form
                          key={activeProject.id + activeProject.updatedAt}
                          className="saas-project-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void execute(async () => {
                              await api(orgPath + '/projects/' + activeProject.id, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  title: f.get('title'),
                                  description: f.get('description'),
                                  status: f.get('status')
                                })
                              });
                              await refresh();
                            });
                          }}
                        >
                          <label>
                            {t('Project title')}
                            <input
                              name="title"
                              defaultValue={activeProject.title}
                              required
                              maxLength={120}
                              disabled={!writer}
                            />
                          </label>
                          <label>
                            {t('Description')}
                            <textarea
                              name="description"
                              defaultValue={activeProject.description}
                              maxLength={2000}
                              disabled={!writer}
                            />
                          </label>
                          <label>
                            {t('Status')}
                            <select
                              name="status"
                              defaultValue={activeProject.status}
                              disabled={!writer}
                            >
                              {projectStages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {t(s.label)}
                                </option>
                              ))}
                            </select>
                          </label>
                          {writer && (
                            <div className="saas-actions">
                              <button disabled={busy}>{t('Save changes')}</button>
                              <button
                                type="button"
                                className="saas-danger"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm(t('Delete this project and its tasks?')))
                                    void execute(async () => {
                                      await api(orgPath + '/projects/' + activeProject.id, {
                                        method: 'DELETE'
                                      });
                                      setCurrentProject(null);
                                      await refresh();
                                    }, 'Project deleted');
                                }}
                              >
                                {t('Delete project')}
                              </button>
                            </div>
                          )}
                        </form>
                        <h3>{t('Tasks')}</h3>
                        {writer && (
                          <form
                            className="saas-inline"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const title = String(new FormData(form).get('title'));
                              void execute(async () => {
                                await api(orgPath + '/projects/' + activeProject.id + '/tasks', {
                                  method: 'POST',
                                  body: JSON.stringify({ title })
                                });
                                form.reset();
                                await reloadTasks();
                              }, 'Task created');
                            }}
                          >
                            <label>
                              {t('Task title')}
                              <input name="title" required maxLength={160} />
                            </label>
                            <button disabled={busy}>{t('Add task')}</button>
                          </form>
                        )}
                        {tasks.length === 0 && <p>{t('No tasks yet')}</p>}
                        {tasks.map((task) => (
                          <article key={task.id} className="saas-task">
                            <form
                              key={task.title + task.status + task.assigneeId + task.dueAt}
                              onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget),
                                  assignee = String(f.get('assigneeId')),
                                  due = String(f.get('dueAt'));
                                void execute(async () => {
                                  await api(orgPath + '/tasks/' + task.id, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      title: f.get('title'),
                                      status: f.get('status'),
                                      assigneeId: assignee ? Number(assignee) : null,
                                      dueAt: due ? due + 'T12:00:00Z' : null
                                    })
                                  });
                                  await reloadTasks();
                                });
                              }}
                            >
                              <div className="saas-task-fields">
                                <label>
                                  {t('Task title')}
                                  <input
                                    aria-label={t('Task title') + ' ' + task.title}
                                    name="title"
                                    defaultValue={task.title}
                                    required
                                    maxLength={160}
                                    disabled={!writer}
                                  />
                                </label>
                                <label>
                                  {t('Task status')}
                                  <select
                                    aria-label={t('Task status') + ' ' + task.title}
                                    name="status"
                                    defaultValue={task.status}
                                    disabled={!writer}
                                  >
                                    {taskStages.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {t(s.label)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  {t('Assignee')}
                                  <select
                                    aria-label={t('Assignee') + ' ' + task.title}
                                    name="assigneeId"
                                    defaultValue={task.assigneeId ?? ''}
                                    disabled={!writer}
                                  >
                                    <option value="">{t('Unassigned')}</option>
                                    {members.map((m) => (
                                      <option key={m.userId} value={m.userId}>
                                        {m.user.name ?? m.user.email}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  {t('Due date')}
                                  <input
                                    aria-label={t('Due date') + ' ' + task.title}
                                    name="dueAt"
                                    type="date"
                                    defaultValue={task.dueAt?.slice(0, 10) ?? ''}
                                    disabled={!writer}
                                  />
                                </label>
                              </div>
                              {writer && (
                                <div className="saas-actions">
                                  <button disabled={busy}>{t('Save task')}</button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (confirm(t('Delete this task?')))
                                        void execute(async () => {
                                          await api(orgPath + '/tasks/' + task.id, {
                                            method: 'DELETE'
                                          });
                                          await reloadTasks();
                                        }, 'Task deleted');
                                    }}
                                  >
                                    {t('Delete task')}
                                  </button>
                                </div>
                              )}
                            </form>
                            <h4>{t('Comments')}</h4>
                            {task.comments.map((c) => (
                              <div className="saas-comment" key={c.id}>
                                <small>
                                  {c.author.name ?? String(c.authorId)} · {date(c.createdAt)}
                                </small>
                                <p>{c.body}</p>
                                {writer && (manager || c.authorId === user.id) && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      execute(async () => {
                                        await api(orgPath + '/comments/' + c.id, {
                                          method: 'DELETE'
                                        });
                                        await reloadTasks();
                                      }, 'Comment deleted')
                                    }
                                  >
                                    {t('Delete comment')}
                                  </button>
                                )}
                              </div>
                            ))}
                            {writer && (
                              <form
                                className="saas-inline"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget,
                                    body = String(new FormData(form).get('body'));
                                  void execute(async () => {
                                    await api(orgPath + '/tasks/' + task.id + '/comments', {
                                      method: 'POST',
                                      body: JSON.stringify({ body })
                                    });
                                    form.reset();
                                    await reloadTasks();
                                  }, 'Comment added');
                                }}
                              >
                                <label>
                                  {t('Comment')}
                                  <input
                                    aria-label={t('Comment') + ' ' + task.title}
                                    name="body"
                                    required
                                    maxLength={4000}
                                  />
                                </label>
                                <button disabled={busy}>{t('Add comment')}</button>
                              </form>
                            )}
                          </article>
                        ))}
                      </section>
                    )}
                  </section>
                )}
                {tab === 'members' && (
                  <section className="saas-panel">
                    <h2>{t('Members')}</h2>
                    <p>{t('Only members of this organization appear here.')}</p>
                    <div className="saas-member-list">
                      {members.map((m) => (
                        <div className="saas-member" key={m.userId}>
                          <div>
                            <strong>{m.user.name ?? m.user.email}</strong>
                            <small>{m.user.email}</small>
                          </div>
                          <strong>{t(roleLabels[m.role])}</strong>
                          {manager &&
                            m.role !== 'OWNER' &&
                            (role === 'OWNER' || m.role !== 'ADMIN') && (
                              <>
                                <label>
                                  <span className="sr-only">{t('Role') + ' ' + m.user.email}</span>
                                  <select
                                    aria-label={t('Role') + ' ' + m.user.email}
                                    value={m.role}
                                    disabled={busy}
                                    onChange={(e) =>
                                      execute(async () => {
                                        await api(orgPath + '/members/' + m.userId, {
                                          method: 'PATCH',
                                          body: JSON.stringify({ role: e.target.value })
                                        });
                                        await refresh();
                                      })
                                    }
                                  >
                                    {(role === 'OWNER'
                                      ? (['ADMIN', 'MEMBER', 'VIEWER'] as const)
                                      : (['MEMBER', 'VIEWER'] as const)
                                    ).map((r) => (
                                      <option key={r} value={r}>
                                        {t(roleLabels[r])}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    if (confirm(t('Remove this member?')))
                                      void execute(async () => {
                                        await api(orgPath + '/members/' + m.userId, {
                                          method: 'DELETE'
                                        });
                                        await refresh();
                                      }, 'Member removed');
                                  }}
                                >
                                  {t('Remove')}
                                </button>
                              </>
                            )}
                          {role === 'OWNER' && m.userId !== user.id && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    t(
                                      'Transfer ownership to this member? You will become an administrator.'
                                    )
                                  )
                                )
                                  void execute(async () => {
                                    await api(orgPath + '/transfer', {
                                      method: 'POST',
                                      body: JSON.stringify({ userId: m.userId })
                                    });
                                    await loadOrganizations();
                                    await refresh();
                                  }, 'Ownership transferred');
                              }}
                            >
                              {t('Transfer ownership')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {manager && (
                      <>
                        <h3>{t('Invite a teammate')}</h3>
                        <form
                          className="saas-inline"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void execute(async () => {
                              const { data } = await api<ApiResponse<{ link: string }>>(
                                orgPath + '/invitations',
                                {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    email: f.get('email'),
                                    role: f.get('role')
                                  })
                                }
                              );
                              setInvitationLink(data.link);
                              setInvitations(
                                (await api<ApiResponse<Invitation[]>>(orgPath + '/invitations'))
                                  .data
                              );
                            }, 'Invitation created');
                          }}
                        >
                          <label>
                            {t('Invited email')}
                            <input name="email" type="email" required maxLength={254} />
                          </label>
                          <label>
                            {t('Invitation role')}
                            <select name="role" defaultValue="MEMBER">
                              {(role === 'OWNER'
                                ? (['ADMIN', 'MEMBER', 'VIEWER'] as const)
                                : (['MEMBER', 'VIEWER'] as const)
                              ).map((r) => (
                                <option value={r} key={r}>
                                  {t(roleLabels[r])}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button disabled={busy}>{t('Create invitation')}</button>
                        </form>
                        <p>
                          {t(
                            'Links expire after 48 hours. Share privately with the invited person.'
                          )}
                        </p>
                        {invitationLink && (
                          <label>
                            {t('Invitation link')}
                            <input
                              aria-label={t('Invitation link')}
                              readOnly
                              value={invitationLink}
                              onFocus={(e) => e.target.select()}
                            />
                          </label>
                        )}
                        <div className="saas-invitations">
                          {invitations.map((i) => (
                            <div key={i.id}>
                              <span>
                                {i.email} · {t(roleLabels[i.role])} · {date(i.expiresAt)}
                              </span>
                              <span>
                                {i.acceptedAt
                                  ? t('Accepted')
                                  : i.revokedAt
                                    ? t('Revoked')
                                    : new Date(i.expiresAt) < new Date()
                                      ? t('Expired')
                                      : t('Pending')}
                              </span>
                              {!i.acceptedAt && !i.revokedAt && (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    execute(async () => {
                                      await api(orgPath + '/invitations/' + i.id, {
                                        method: 'DELETE'
                                      });
                                      setInvitations(
                                        (
                                          await api<ApiResponse<Invitation[]>>(
                                            orgPath + '/invitations'
                                          )
                                        ).data
                                      );
                                    }, 'Invitation revoked')
                                  }
                                >
                                  {t('Revoke')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                )}
                {tab === 'audit' && manager && (
                  <section className="saas-panel">
                    <h2>{t('Audit log')}</h2>
                    <p>{t('Latest 100 events. Audit records cannot be edited here.')}</p>
                    {logs.map((log) => (
                      <article className="saas-audit" key={log.id}>
                        <strong>
                          {actionLabels[log.action] ? t(actionLabels[log.action]!) : log.action}
                        </strong>
                        <p>
                          {members.find((m) => m.userId === log.actorId)?.user.name ??
                            String(log.actorId)}{' '}
                          · {date(log.createdAt)}
                        </p>
                        <small>
                          {t('Object')}: {log.objectId} · {t('Request {id}', { id: log.requestId })}
                        </small>
                        {Object.keys(log.details).length > 0 && (
                          <details>
                            <summary>{t('Details')}</summary>
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </details>
                        )}
                      </article>
                    ))}
                  </section>
                )}
                {tab === 'settings' && manager && (
                  <section className="saas-panel">
                    <h2>{t('Settings')}</h2>
                    <form
                      className="saas-inline"
                      key={membership?.organization.name}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = String(new FormData(e.currentTarget).get('name'));
                        void execute(async () => {
                          await api(orgPath, { method: 'PATCH', body: JSON.stringify({ name }) });
                          await loadOrganizations();
                        }, 'Organization updated');
                      }}
                    >
                      <label>
                        {t('Organization name')}
                        <input
                          name="name"
                          defaultValue={membership?.organization.name}
                          required
                          maxLength={100}
                        />
                      </label>
                      <button disabled={busy}>{t('Save changes')}</button>
                    </form>
                    <hr />
                    <h3>{t('Create another organization')}</h3>
                    <p>{t('Each organization has its own members, projects and audit trail.')}</p>
                    <form className="saas-inline" onSubmit={createOrganization}>
                      <label>
                        {t('New organization name')}
                        <input name="name" required maxLength={100} />
                      </label>
                      <button disabled={busy}>{t('Create organization')}</button>
                    </form>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
