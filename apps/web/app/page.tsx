'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { GettingStarted } from '@/components/getting-started';
import { formatDate } from '@toolkit/i18n';
import { LanguageSwitcher, useLocale } from '@/components/locale-provider';
import { localizeError } from '@/lib/localize-error';
import type { MessageKey } from '@/lib/messages';
import type { ApiResponse, Project, ProjectStatus, User } from '@repo/types';
import { api, RequestError } from '@/lib/api';

const stages: { id: ProjectStatus; label: MessageKey }[] = [
  { id: 'PLANNED', label: 'Planned' },
  { id: 'ACTIVE', label: 'In progress' },
  { id: 'DONE', label: 'Completed' }
];
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'brand-mark small' : 'brand-mark'} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function ProjectDialog({
  project,
  onClose,
  onSave
}: {
  project: Project | null;
  onClose: () => void;
  onSave: (input: { title: string; description: string; status: ProjectStatus }) => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await onSave({
        title: String(data.get('title')),
        description: String(data.get('description')),
        status: data.get('status') as ProjectStatus
      });
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="project-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <h2 id="dialog-title">{project ? t('Edit project') : t('Start something new')}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t('Close project form')}
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label>
          {t('Project title')}
          <input
            name="title"
            required
            minLength={1}
            maxLength={120}
            defaultValue={project?.title}
            placeholder={t('What are you building?')}
            autoFocus
          />
        </label>
        <label>
          {t('Description')}
          <textarea
            name="description"
            maxLength={2000}
            rows={4}
            defaultValue={project?.description}
            placeholder={t('A little context goes a long way.')}
          />
        </label>
        <label>
          {t('Status')}
          <select
            aria-label={t('Status')}
            name="status"
            defaultValue={project?.status ?? 'PLANNED'}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {t(stage.label)}
              </option>
            ))}
          </select>
        </label>
        {Boolean(error) && (
          <p role="alert" className="form-error">
            {localizeError(error, locale)}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? t('Saving…') : project ? t('Save changes') : t('Create project')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Home() {
  const { locale, t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<MessageKey | ''>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[] | null>(null);
  const [dialog, setDialog] = useState<{ project: Project | null } | null>(null);
  const [search, setSearch] = useState('');
  const [service, setService] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const fail = useCallback((error: unknown) => {
    if (error instanceof RequestError && error.code === 'UNAUTHENTICATED') {
      setUser(null);
      setProjects([]);
    }
    setError(error);
  }, []);
  useEffect(() => {
    let active = true;
    api<ApiResponse<User>>('/auth/me')
      .then((result) => {
        if (active) setUser(result.data);
      })
      .catch((error) => {
        if (active && (!(error instanceof RequestError) || error.code !== 'UNAUTHENTICATED'))
          fail(error);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    api<{ status: string }>('/health')
      .then((result) => {
        if (active) setService(result.status === 'ok' ? 'connected' : 'unavailable');
      })
      .catch(() => {
        if (active) setService('unavailable');
      });
    return () => {
      active = false;
    };
  }, [fail]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    api<ApiResponse<Project[]>>('/projects', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProjects(result.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) fail(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, fail]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const data = new FormData(event.currentTarget);
    const input = {
      email: String(data.get('email')),
      password: String(data.get('password')),
      ...(mode === 'register' ? { name: String(data.get('name')) } : {})
    };
    try {
      setUser(
        (
          await api<ApiResponse<User>>('/auth/' + mode, {
            method: 'POST',
            body: JSON.stringify(input)
          })
        ).data
      );
      setNotice(mode === 'register' ? 'Your workspace is ready.' : 'Welcome back.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setProjects([]);
      setMembers(null);
      setNotice('You have signed out securely.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function saveProject(input: { title: string; description: string; status: ProjectStatus }) {
    const existing = dialog?.project;
    const result = await api<ApiResponse<Project>>(
      existing ? '/projects/' + existing.id : '/projects',
      { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(input) }
    );
    setProjects((current) =>
      existing
        ? current.map((item) => (item.id === existing.id ? result.data : item))
        : [result.data, ...current]
    );
    setNotice(existing ? 'Project updated.' : 'Project created.');
    setError('');
  }
  async function removeProject(project: Project) {
    if (!window.confirm(t('Delete “{title}”? This cannot be undone.', { title: project.title })))
      return;
    setBusy(true);
    setError('');
    try {
      await api('/projects/' + project.id, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setNotice('Project deleted.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function showMembers() {
    setBusy(true);
    setError('');
    try {
      setMembers((await api<ApiResponse<User[]>>('/users')).data);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  const filtered = projects.filter((project) =>
    (project.title + ' ' + project.description).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Mark small />
          <span>
            fullstack<span className="brand-light"> / toolkit</span>
          </span>
        </Link>
        <nav aria-label={t('Main navigation')}>
          <a
            className={!members ? 'nav-item selected' : 'nav-item'}
            href={user ? '#projects' : '#account'}
            onClick={() => setMembers(null)}
          >
            <span aria-hidden="true">▦</span>
            {t('Projects')} {user && <span className="nav-count">{projects.length}</span>}
          </a>
          {user?.role === 'ADMIN' && (
            <button
              className={members ? 'nav-item selected' : 'nav-item'}
              disabled={busy}
              onClick={showMembers}
            >
              <span aria-hidden="true">◎</span>
              {t('Members')}
            </button>
          )}
          <a className="nav-item" href="#guide">
            <span aria-hidden="true">≡</span>
            {t('Getting started')} <Arrow />
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="service-status" data-testid="api-status">
            <span className={service === 'connected' ? 'status-dot' : 'status-dot muted'} />
            {t(
              service === 'connected'
                ? 'API connected'
                : service === 'unavailable'
                  ? 'API unavailable'
                  : 'Checking API'
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t('Workspace')} <span>/</span>{' '}
            <strong>{members ? t('Members') : t('Projects')}</strong>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            {user && (
              <>
                <span className="avatar" title={user.email}>
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </span>
                <button className="text-button" disabled={busy} onClick={logout}>
                  {t('Sign out')}
                </button>
              </>
            )}
          </div>
        </header>
        <main id="workspace" className="main-content">
          <div className="page-heading">
            <h1>{members ? t('Members') : user ? t('Projects') : t('Workspace')}</h1>
          </div>
          <GettingStarted />
          {Boolean(error) && (
            <div role="alert" className="message error">
              <strong>{t('We couldn’t finish that request.')}</strong>
              <span>{localizeError(error, locale)}</span>
              <button className="text-button" onClick={() => setError('')}>
                {t('Dismiss')}
              </button>
            </div>
          )}
          <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
            {notice ? t(notice) : null}
          </div>
          {checking ? (
            <div id={user ? 'projects' : 'account'} className="loading-panel">
              {t('Opening your workspace…')}
            </div>
          ) : !user ? (
            <section id="account" className="welcome-grid">
              <div className="auth-panel">
                <h2>{mode === 'register' ? t('Create account') : t('Sign in')}</h2>
                <p>
                  {mode === 'register'
                    ? t('Your projects are private to your account.')
                    : t('Sign in to pick up where you left off.')}
                </p>
                <div className="auth-tabs">
                  <button
                    className={mode === 'register' ? 'active' : ''}
                    onClick={() => {
                      setMode('register');
                      setError('');
                    }}
                    disabled={busy}
                  >
                    {t('Create account')}
                  </button>
                  <button
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    disabled={busy}
                  >
                    {t('Sign in')}
                  </button>
                </div>
                <form onSubmit={authenticate} key={mode}>
                  {mode === 'register' && (
                    <label>
                      {t('Your name')}
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={80}
                        placeholder={t('Alex Morgan')}
                      />
                    </label>
                  )}
                  <label>
                    {t('Email address')}
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    {t('Password')}
                    <input
                      name="password"
                      type="password"
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      required
                      minLength={12}
                      maxLength={128}
                      placeholder={t('At least 12 characters')}
                    />
                  </label>
                  <p className="field-help">
                    {t('Use a unique password with at least 12 characters.')}
                  </p>
                  <button className="button primary full-width" disabled={busy}>
                    {busy
                      ? t('One moment…')
                      : mode === 'register'
                        ? t('Create account')
                        : t('Sign in')}
                    <Arrow />
                  </button>
                </form>
                <div className="auth-footnote">
                  <span aria-hidden="true">◇</span>{' '}
                  {t('Your projects are private to your account.')}
                </div>
              </div>
            </section>
          ) : members ? (
            <section className="members-panel">
              <div className="section-heading">
                <h2>{t('Member directory')}</h2>
                <button className="button secondary" onClick={() => setMembers(null)}>
                  {t('Back to projects')}
                </button>
              </div>
              <p className="subtitle">{t('Administrator view · newest 100 members')}</p>
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.id}>
                    <span className="avatar">
                      {(member.name ?? member.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{member.name ?? t('Unnamed member')}</strong>
                      <span>{member.email}</span>
                    </div>
                    <span className="role-tag">{t(member.role)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="overview" aria-label={t('Workspace overview')}>
                <div>
                  <span>{t('YOUR PROJECTS')}</span>
                  <strong>{projects.length.toString().padStart(2, '0')}</strong>
                </div>
                <div>
                  <span>{t('IN PROGRESS')}</span>
                  <strong>
                    {projects
                      .filter((project) => project.status === 'ACTIVE')
                      .length.toString()
                      .padStart(2, '0')}
                  </strong>
                </div>
                <div>
                  <span>{t('COMPLETED')}</span>
                  <strong>
                    {projects
                      .filter((project) => project.status === 'DONE')
                      .length.toString()
                      .padStart(2, '0')}
                  </strong>
                </div>
              </section>
              <section id="projects" className="workspace-board" aria-label={t('Project board')}>
                <div className="section-heading">
                  <div>
                    <h2>
                      {t('Project board')} <span>{projects.length}</span>
                    </h2>
                    <p>{t('Your work, from possibility to done. Showing up to 100 projects.')}</p>
                  </div>
                  <button className="button primary" onClick={() => setDialog({ project: null })}>
                    {t('+ New project')}
                  </button>
                </div>
                <div className="board-toolbar">
                  <label className="search-label">
                    <span className="sr-only">{t('Search projects')}</span>
                    <input
                      type="search"
                      placeholder={t('Search projects…')}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                {loading ? (
                  <div className="loading-panel">{t('Loading your projects…')}</div>
                ) : (
                  <div className="board-columns">
                    {stages.map((stage) => {
                      const items = filtered.filter((project) => project.status === stage.id);
                      return (
                        <section
                          className="board-column"
                          key={stage.id}
                          aria-label={t(stage.label)}
                        >
                          <div className="column-heading">
                            <span className={'stage-dot ' + stage.id.toLowerCase()} />
                            <h3>{t(stage.label)}</h3>
                            <span>{items.length}</span>
                          </div>
                          <div className="project-list">
                            {items.map((project) => (
                              <article className="project-card" key={project.id}>
                                <h4>{project.title}</h4>
                                <p>{project.description || t('No description')}</p>
                                <div className="card-bottom">
                                  <span>
                                    {t('Updated')}{' '}
                                    {formatDate(project.updatedAt, locale, {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  <div>
                                    <button
                                      className="text-button"
                                      disabled={busy}
                                      aria-label={t('Edit {title}', { title: project.title })}
                                      onClick={() => setDialog({ project })}
                                    >
                                      {t('Edit')}
                                    </button>
                                    <button
                                      className="text-button danger"
                                      disabled={busy}
                                      aria-label={t('Delete {title}', { title: project.title })}
                                      onClick={() => removeProject(project)}
                                    >
                                      {t('Delete')}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            ))}
                            {items.length === 0 && (
                              <div className="column-empty">
                                <p>{search ? t('No matching projects') : t('No projects')}</p>
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
          <p className="manual-link">
            <Link href="/manual">
              {t('User manual')} <Arrow />
            </Link>
          </p>
        </main>
      </div>
      {dialog && (
        <ProjectDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onSave={saveProject}
        />
      )}
    </div>
  );
}
