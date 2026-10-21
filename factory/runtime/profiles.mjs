export const VERSION = '1.1.0';
export const REVIEWERS = ['security', 'ux', 'ui', 'code', 'qa'];
const claude = {
  orchestrator: 'claude', 'spec-writer': 'claude', builder: 'claude',
  'documentation-writer': 'claude', security: 'claude', ux: 'claude',
  ui: 'claude', code: 'claude', qa: 'claude', approver: 'claude'
};
export const PROFILES = Object.freeze({
  'claude-only': {
    label: 'Claude only', owner: 'claude', tools: ['git', 'claude'],
    skills: ['.claude/skills/factory/SKILL.md'], roles: claude
  },
  'codex-claude': {
    label: 'Codex + Claude', owner: 'codex', tools: ['git', 'codex', 'claude'],
    skills: ['.agents/skills/factory/SKILL.md', '.claude/skills/factory/SKILL.md'],
    roles: { ...claude, orchestrator: 'codex', security: 'codex', code: 'codex', qa: 'codex' }
  },
  'low-cost': {
    label: 'API providers', owner: 'deepseek', tools: ['git'], skills: [],
    roles: {
      orchestrator: 'deepseek', 'spec-writer': 'qwen', builder: 'kimi',
      'documentation-writer': 'qwen', security: 'deepseek', ux: 'qwen',
      ui: 'kimi', code: 'kimi', qa: 'deepseek', approver: 'qwen'
    }
  }
});
export function models(edition) {
  const selected = profile(edition);
  return Object.fromEntries(Object.entries(selected.roles).map(([role, runtime]) => [role,
    runtime === 'claude' ? (['spec-writer', 'builder', 'security', 'approver'].includes(role) ? 'claude-opus-5-5' : role === 'orchestrator' ? null : 'claude-sonnet-5-5') :
    runtime === 'codex' ? (role === 'security' ? 'gpt-6-astra' : 'gpt-6.1-sol') :
    runtime === 'deepseek' ? 'deepseek-flash' : runtime === 'qwen' ? 'qwen3.8-max' : role === 'builder' ? 'kimi-k3' : 'kimi-k2.7-code'
  ]));
}
export function profile(edition) {
  if (!Object.hasOwn(PROFILES, edition)) throw new Error('Choose claude-only, codex-claude or low-cost.');
  return PROFILES[edition];
}
