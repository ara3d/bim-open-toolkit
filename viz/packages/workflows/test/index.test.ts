import { describe, expect, it } from 'vitest';
import { allWorkflows, workflows } from '../src/registry.js';
import { describeWorkflows, runWorkflow, workflowRegistry } from '../src/workflow.js';

describe('the workflow registry', () => {
  it('holds every workflow under a distinct id', () => {
    expect(workflows.size).toBe(allWorkflows.length);
    expect([...workflows.keys()]).toEqual(allWorkflows.map((item) => item.id));
  });

  it('describes every input as a JSON schema a tool descriptor can be generated from', () => {
    for (const item of describeWorkflows(workflows)) {
      expect(item.inputSchema.type).toBe('object');
      expect(item.description.length).toBeGreaterThan(0);
      expect(['synthetic', 'source-backed', 'mixed']).toContain(item.basis);
    }
  });

  it('reports an input that is not what the workflow asked for, rather than running on it', () => {
    const result = runWorkflow(workflows, 'door-schedule', { storeys: 'not a table' });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain('schema/type');
  });

  it('reports an unknown workflow name', () => {
    expect(runWorkflow(workflows, 'no-such-workflow', {}).diagnostics.map((item) => item.code)).toEqual([
      'workflow/unknown',
    ]);
  });

  it('refuses a registry that holds two workflows of one id', () => {
    const first = allWorkflows[0];
    expect(first === undefined ? true : workflowRegistry([first, first]).ok).toBe(false);
  });
});
