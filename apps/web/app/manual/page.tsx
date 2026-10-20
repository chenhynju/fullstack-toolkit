'use client';
import Link from 'next/link';
import { LanguageSwitcher, useLocale } from '@/components/locale-provider';
import manual from '@/content/manual.json';
export default function ManualPage() {
  const { locale, t } = useLocale();
  const content = manual[locale];
  return (
    <main className="manual-shell">
      <nav className="manual-nav" aria-label={t('Main navigation')}>
        <Link href="/">← fullstack / toolkit</Link>
        <LanguageSwitcher />
      </nav>
      <h1>{content.title}</h1>
      <p className="manual-intro">
        {locale === 'zh-CN'
          ? '此页保留旧版工程模板资料。当前企业工作空间的操作说明请查看'
          : 'This page preserves the earlier engineering template reference. For the current team workspace, read '}{' '}
        <Link href="/help">{locale === 'zh-CN' ? '团队操作手册' : 'the team manual'}</Link>。
      </p>
      <p className="manual-intro">{content.intro}</p>
      <nav className="manual-toc" aria-label={t('User manual')}>
        {content.sections.map((section) => (
          <a key={section.id} href={'#' + section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      {content.sections.map((section) => (
        <section className="manual-section" id={section.id} key={section.id}>
          <h2>{section.title}</h2>
          <ol>
            {section.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
