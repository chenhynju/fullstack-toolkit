'use client';
import Link from 'next/link';
import { useLocale } from './locale-provider';
import copy from '@/content/getting-started.json';
export function GettingStarted() {
  const { locale } = useLocale();
  const content = copy[locale];
  return (
    <section id="guide" className="usage-guide" aria-labelledby="usage-heading">
      <header>
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="usage-heading">{content.title}</h2>
        <p>{content.intro}</p>
      </header>
      <p className="usage-boundary">{content.boundary}</p>
      <nav aria-label={locale === 'en' ? 'Usage steps' : '使用步骤'} className="usage-index">
        {content.steps.map((step, index) => (
          <a key={step.title} href={'#usage-step-' + (index + 1)}>
            {String(index + 1).padStart(2, '0')} · {step.title}
          </a>
        ))}
      </nav>
      <ol className="usage-steps">
        {content.steps.map((step, index) => (
          <li key={step.title} id={'usage-step-' + (index + 1)}>
            <h3>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {step.title}
            </h3>
            <p>{step.body}</p>
            {step.code && (
              <pre tabIndex={0}>
                <code>{step.code}</code>
              </pre>
            )}
            <p className="usage-note">{step.note}</p>
            {index === 1 && (
              <div className="usage-map">
                <h4>{content.mapTitle}</h4>
                <dl>
                  {content.map.map(([path, description]) => (
                    <div key={path}>
                      <dt>
                        <code>{path}</code>
                      </dt>
                      <dd>{description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="usage-links">
        <a href="https://github.com/chenhynju/fullstack-toolkit">{content.repo} ↗</a>
        <Link href="/manual">{content.manual}</Link>
        <a href="https://github.com/chenhynju/fullstack-toolkit/blob/main/docs/deployment.md">
          {content.runbook} ↗
        </a>
      </div>
      <p className="usage-demo-note">{content.demo}</p>
    </section>
  );
}
