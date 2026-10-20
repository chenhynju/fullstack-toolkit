'use client';
import Link from 'next/link';
import { LanguageSwitcher, useLocale } from '@/components/locale-provider';

export default function Help() {
  const { locale } = useLocale();
  const zh = locale === 'zh-CN';
  const steps = zh
    ? [
        [
          '建立组织',
          '注册或登录后创建组织。每个组织拥有独立的成员、项目和审计记录。组织切换器决定当前工作空间。'
        ],
        [
          '邀请同事',
          '在成员页填写受邀者邮箱与角色，创建邀请并私下分享链接。链接在 48 小时后失效，只能由该邮箱登录的账号接受一次。可在成员页撤销未接受邀请。'
        ],
        [
          '共同推进项目',
          '在项目页创建项目，点击卡片修改名称、说明和状态。为项目添加任务，分配给组织内成员、设置截止日期并发表评论。删除项目也会删除其任务与评论，请谨慎确认。'
        ],
        [
          '管理权限',
          '所有者负责管理员与所有权转移；管理员可管理普通成员和只读成员；成员可协作项目和任务；只读成员只能查看。移除成员后会清空其任务分配，旧登录会话也不再允许访问该组织。'
        ],
        [
          '检查审计',
          '所有者和管理员可以查看最近 100 条审计事件，包括成员变更、邀请、项目、任务与评论操作。操作和审计共同提交，界面不能修改审计记录。'
        ],
        [
          '多组织协作',
          '同一个账号可在不同组织担任不同角色。各组织的数据互不可见；平台旧管理员身份不授予企业访问权。更改组织名称或创建另一个组织可使用设置页。'
        ]
      ]
    : [
        [
          'Create an organization',
          'After registration or sign-in, create an organization. Each organization has its own members, projects and audit trail. The organization switcher chooses your current workspace.'
        ],
        [
          'Invite teammates',
          'Enter the invited email and role on Members, create an invitation and share its link privately. It expires after 48 hours and can be accepted once by the account with that email. Revoke unused invitations on Members.'
        ],
        [
          'Deliver together',
          'Create a project and open its card to edit its name, description and stage. Add tasks, assign active organization members, set due dates and comment. Deleting a project also deletes its tasks and comments, so review the confirmation.'
        ],
        [
          'Manage permissions',
          'Owners manage administrators and ownership transfers. Administrators manage members and viewers. Members collaborate on projects and tasks. Viewers can only read. Removal clears task assignments and immediately denies that organization to the existing session.'
        ],
        [
          'Review audit',
          'Owners and administrators can read the latest 100 audit events for membership, invitations, projects, tasks and comments. Changes and audit entries commit together. Audit records cannot be edited in the interface.'
        ],
        [
          'Work across organizations',
          'One account can hold different roles in different organizations. Data stays separate; a legacy platform administrator role grants no organization access. Settings allows organization renaming and creation of another organization.'
        ]
      ];
  return (
    <div className="saas-shell">
      <header className="saas-header">
        <Link href="/">← {zh ? '返回工作空间' : 'Back to workspace'}</Link>
        <LanguageSwitcher />
      </header>
      <main className="saas-main">
        <h1>{zh ? '团队工作空间操作手册' : 'Team workspace manual'}</h1>
        {steps.map(([title, body], index) => (
          <section className="saas-panel" key={title}>
            <h2>
              {index + 1}. {title}
            </h2>
            <p>{body}</p>
          </section>
        ))}
        <p>
          <Link href="/manual">
            {zh
              ? '工程模板与部署参考（历史文档，SaaS 部署请以仓库新文档为准）'
              : 'Engineering template reference (historical; use the repository SaaS runbook for deployment)'}
          </Link>
        </p>
      </main>
    </div>
  );
}
