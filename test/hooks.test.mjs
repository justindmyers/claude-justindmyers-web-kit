// Run with `npm test`. Each hook runs as a child process with a hook event on stdin.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = {
  core: join(ROOT, 'plugins/web-core/hooks'),
  react: join(ROOT, 'plugins/web-react/hooks')
};
const HOOK_DIR = {
  'set-explore-model.mjs': HOOKS.core,
  'check-bash-guards.mjs': HOOKS.core,
  'check-pr-body.mjs': HOOKS.core,
  'check-comment-bloat.mjs': HOOKS.core,
  'check-banned-imports.mjs': HOOKS.core,
  'check-ui-conventions.mjs': HOOKS.react,
  'check-new-component-tests.mjs': HOOKS.react
};

const run = (hook, stdin, { args = [], cwd = tmpdir() } = {}) => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const result = spawnSync('node', [join(HOOK_DIR[hook], hook), ...args], {
    input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin),
    encoding: 'utf-8',
    cwd,
    env
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
};

const advisory = (stdout) =>
  stdout ? JSON.parse(stdout).hookSpecificOutput.additionalContext : '';

const createRepo = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'web-kit-hooks-')));
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=hooks-test',
        '-c',
        'user.email=hooks-test@example.com',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args
      ],
      { cwd: root, stdio: 'ignore' }
    );
  const write = (path, content) => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    return full;
  };
  const commit = () => {
    git('add', '-A');
    git('commit', '-q', '-m', 'fixture');
  };
  const configure = (config) => write('.claude/web-kit.json', JSON.stringify(config));

  git('init', '-q');
  write('README.md', 'fixture\n');
  commit();
  return {
    root,
    git,
    write,
    commit,
    configure,
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
};

describe('config.mjs', () => {
  it('is identical in both plugins', () => {
    assert.equal(
      readFileSync(join(HOOKS.core, 'config.mjs'), 'utf-8'),
      readFileSync(join(HOOKS.react, 'config.mjs'), 'utf-8')
    );
  });
});

describe('set-explore-model', () => {
  const agent = (toolInput) => run('set-explore-model.mjs', { tool_input: toolInput });

  it('sets haiku on an Explore call with no model', () => {
    const { code, stdout } = agent({ subagent_type: 'Explore', prompt: 'find x' });
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(stdout).hookSpecificOutput.updatedInput, {
      subagent_type: 'Explore',
      prompt: 'find x',
      model: 'haiku'
    });
  });

  it('keeps a model the caller set', () => {
    assert.equal(agent({ subagent_type: 'Explore', model: 'sonnet' }).stdout, '');
  });

  for (const subagentType of ['general-purpose', 'Plan', undefined]) {
    it(`leaves ${subagentType ?? 'an untyped'} call alone`, () => {
      assert.equal(agent({ subagent_type: subagentType, prompt: 'x' }).stdout, '');
    });
  }

  it('exits 0 on malformed input', () => {
    assert.equal(run('set-explore-model.mjs', 'not json').code, 0);
  });
});

describe('check-bash-guards', () => {
  let repo;
  before(() => {
    repo = createRepo();
    repo.configure({
      blockedCommands: [{ pattern: 'git\\s+push\\b.*--force\\b', message: 'No force-push.' }]
    });
  });
  after(() => repo.cleanup());

  const bash = (command, cwd) => run('check-bash-guards.mjs', { cwd, tool_input: { command } });

  it('blocks --no-verify anywhere in the command', () => {
    const { code, stderr } = bash('git commit --no-verify -m "x"');
    assert.equal(code, 2);
    assert.match(stderr, /Blocked by project rule/);
  });

  it('blocks a project rule from web-kit.json', () => {
    const { code, stderr } = bash('git push --force origin x', repo.root);
    assert.equal(code, 2);
    assert.match(stderr, /No force-push/);
  });

  it('allows normal commands', () => {
    assert.equal(bash('git push origin x', repo.root).code, 0);
    assert.equal(bash('git commit -m "verify"').code, 0);
  });

  it('ignores an invalid project pattern', () => {
    const bad = createRepo();
    bad.configure({ blockedCommands: [{ pattern: '(', message: 'broken' }] });
    assert.equal(bash('ls', bad.root).code, 0);
    bad.cleanup();
  });

  it('exits 0 on malformed input', () => {
    assert.equal(run('check-bash-guards.mjs', 'not json').code, 0);
  });
});

describe('check-pr-body', () => {
  const body = ({ bullets = 2, steps = 2, extra = '', heading = 'Description' } = {}) =>
    [
      `## ${heading}`,
      ...Array.from({ length: bullets }, (_, i) => `- change ${i + 1}`),
      '',
      '## Validation Steps',
      ...Array.from({ length: steps }, (_, i) => `${i + 1}. step ${i + 1}`),
      extra
    ].join('\n');
  const pr = (text, cwd) =>
    run('check-pr-body.mjs', {
      cwd,
      tool_input: { command: `gh pr create --title "x" --body "${text}"` }
    });

  it('ignores commands that are not gh pr create/edit', () => {
    assert.equal(run('check-pr-body.mjs', { tool_input: { command: 'git push' } }).code, 0);
  });

  it('allows a short body', () => {
    assert.equal(pr(body()).code, 0);
  });

  it('blocks more than 3 Description bullets', () => {
    const { code, stderr } = pr(body({ bullets: 4 }));
    assert.equal(code, 2);
    assert.match(stderr, /4 bullets/);
  });

  it('blocks a bullet over 200 chars', () => {
    const { code, stderr } = pr(`## Description\n- ${'x'.repeat(220)}\n`);
    assert.equal(code, 2);
    assert.match(stderr, /chars/);
  });

  it('blocks prose in the Description', () => {
    assert.match(pr('## Description\nA paragraph.\n- bullet\n').stderr, /one-line bullets only/);
  });

  it('blocks more than 3 validation steps', () => {
    assert.match(pr(body({ steps: 4 })).stderr, /Validation Steps has 4/);
  });

  it('blocks a table and a code block', () => {
    const { stderr } = pr(body({ extra: '\n| a | b |\n```\ncode\n```' }));
    assert.match(stderr, /table/);
    assert.match(stderr, /code block/);
  });

  describe('with a project config and --body-file', () => {
    let repo;
    before(() => {
      repo = createRepo();
      repo.configure({ prBody: { descriptionHeading: 'Summary (what)', maxBullets: 1 } });
    });
    after(() => repo.cleanup());

    it('uses the configured heading and limits', () => {
      const { code, stderr } = pr(body({ heading: 'Summary (what)' }), repo.root);
      assert.equal(code, 2);
      assert.match(stderr, /Summary \(what\) has 2 bullets \(max 1\)/);
    });

    it('reads a relative path against the event cwd and blocks over 25 lines', () => {
      repo.write('pr.md', body({ extra: Array.from({ length: 25 }, () => 'note').join('\n') }));
      const { code, stderr } = run('check-pr-body.mjs', {
        cwd: repo.root,
        tool_input: { command: 'gh pr edit 1 --body-file pr.md' }
      });
      assert.equal(code, 2);
      assert.match(stderr, /non-empty lines/);
    });
  });

  it('exits 0 on malformed input', () => {
    assert.equal(run('check-pr-body.mjs', 'not json').code, 0);
  });
});

describe('check-banned-imports', () => {
  let repo;
  before(() => {
    repo = createRepo();
    repo.configure({
      bannedImports: [{ pattern: "from ['\"]legacy-lib['\"]", message: 'Use new-lib.' }]
    });
  });
  after(() => repo.cleanup());

  const check = (path) =>
    advisory(
      run('check-banned-imports.mjs', { cwd: repo.root, tool_input: { file_path: path } }).stdout
    );

  it('flags a banned import', () => {
    assert.match(check(repo.write('src/a.ts', "import x from 'legacy-lib';\n")), /Use new-lib/);
  });

  it('skips clean files, .claude files and non-code files', () => {
    assert.equal(check(repo.write('src/b.ts', "import x from 'new-lib';\n")), '');
    assert.equal(check(repo.write('.claude/hooks/c.mjs', "import x from 'legacy-lib';\n")), '');
    assert.equal(check(repo.write('src/d.md', "from 'legacy-lib'\n")), '');
  });

  it('is quiet with no config', () => {
    const bare = createRepo();
    const path = bare.write('src/a.ts', "import x from 'legacy-lib';\n");
    assert.equal(
      run('check-banned-imports.mjs', { cwd: bare.root, tool_input: { file_path: path } }).stdout,
      ''
    );
    bare.cleanup();
  });
});

describe('check-comment-bloat', () => {
  let repo;
  before(() => {
    repo = createRepo();
  });
  after(() => repo.cleanup());

  const check = (path) =>
    advisory(
      run('check-comment-bloat.mjs', { cwd: repo.root, tool_input: { file_path: path } }).stdout
    );

  it('flags a 3-line // run, a 4-line block, and a doc comment above a component', () => {
    const path = repo.write(
      'src/feature/Widget.tsx',
      [
        '// one',
        '// two',
        '// three',
        'const a = 1;',
        '/**',
        ' * one',
        ' * two',
        ' */',
        'const b = 2;',
        '/** Widget. */',
        'export const Widget = () => null;'
      ].join('\n')
    );
    const context = check(path);
    assert.match(context, /3-line `\/\/` comment/);
    assert.match(context, /4-line block comment/);
    assert.match(context, /top-level component `Widget`/);
  });

  it('flags even a 1-line comment above a component, but allows a 2-line // run elsewhere', () => {
    const path = repo.write('src/feature/Ok.tsx', '// why\nexport const Ok = () => null;\n');
    assert.match(check(path), /top-level component/);
    const plain = repo.write('src/feature/ok.ts', '// why\n// and why\nconst a = 1;\n');
    assert.equal(check(plain), '');
  });

  it('only flags comments on lines changed vs HEAD', () => {
    const path = repo.write('src/feature/legacy.ts', '// one\n// two\n// three\nconst a = 1;\n');
    repo.commit();
    repo.write('src/feature/legacy.ts', '// one\n// two\n// three\nconst a = 2;\n');
    assert.equal(check(path), '');
  });

  it('reads limits from web-kit.json', () => {
    const custom = createRepo();
    custom.configure({ comments: { maxLineRun: 3 } });
    const path = custom.write('src/a.ts', '// one\n// two\n// three\nconst a = 1;\n');
    assert.equal(
      run('check-comment-bloat.mjs', { cwd: custom.root, tool_input: { file_path: path } }).stdout,
      ''
    );
    custom.cleanup();
  });
});

describe('check-ui-conventions', () => {
  let repo;
  before(() => {
    repo = createRepo();
  });
  after(() => repo.cleanup());

  const check = (path, cwd = repo.root) =>
    advisory(run('check-ui-conventions.mjs', { cwd, tool_input: { file_path: path } }).stdout);

  const BAD = [
    'export const Bad = () => (',
    '  <div className="text-slate-800 dark:text-white bg-[#ff0000]" onClick={go}>',
    '    <img src="a.png" />',
    '    <Button tabIndex={2} />',
    '    <td className="hidden md:table-cell" />',
    '  </div>',
    ');',
    '// eslint-disable-next-line react-hooks/exhaustive-deps',
    'const Row = () => null;'
  ].join('\n');

  it('flags each rule in a new file', () => {
    const context = check(repo.write('src/feature/Bad.tsx', BAD));
    for (const pattern of [
      /Manual light\/dark color pair/,
      /Arbitrary hex color/,
      /`tabIndex` greater than 0/,
      /Hidden table column/,
      /exhaustive-deps/,
      /`<div>` with a click handler/,
      /`<img>` without `alt`/,
      /2 PascalCase declarations \(Bad, Row\)/
    ]) {
      assert.match(context, pattern);
    }
  });

  it('is quiet on conforming code', () => {
    const path = repo.write(
      'src/feature/Good.tsx',
      [
        'const MAX_ROWS = 3;',
        'export const GoodContext = createContext(null);',
        'export const Good = () => (',
        '  <div className="text-text-default" role="button" onClick={go}>',
        '    <img src="a.png" alt="" />',
        '    <Button tabIndex={0} />',
        '  </div>',
        ');'
      ].join('\n')
    );
    assert.equal(check(path), '');
  });

  it('skips tests, stories and files outside sourceRoots', () => {
    assert.equal(check(repo.write('src/feature/Bad.test.tsx', BAD)), '');
    assert.equal(check(repo.write('src/feature/Bad.stories.tsx', BAD)), '');
    assert.equal(check(repo.write('scripts/Bad.tsx', BAD)), '');
  });

  it('honors custom sourceRoots and themeTokenHint', () => {
    const custom = createRepo();
    custom.configure({ sourceRoots: ['packages/ui/'], themeTokenHint: 'Use tokens.css.' });
    assert.equal(check(custom.write('src/Bad.tsx', BAD), custom.root), '');
    assert.match(check(custom.write('packages/ui/Bad.tsx', BAD), custom.root), /Use tokens\.css/);
    custom.cleanup();
  });

  it('only flags lines changed vs HEAD', () => {
    const path = repo.write(
      'src/feature/Legacy.tsx',
      'export const Legacy = () => <p className="text-slate-800 dark:text-white" />;\n'
    );
    repo.commit();
    repo.write(
      'src/feature/Legacy.tsx',
      'export const Legacy = () => <p className="text-slate-800 dark:text-white" />;\nconst x = 1;\n'
    );
    assert.equal(check(path), '');

    repo.write(
      'src/feature/Legacy.tsx',
      'export const Legacy = () => <p className="text-slate-800 dark:text-white" />;\nconst x = <p tabIndex={1} />;\n'
    );
    const context = check(path);
    assert.match(context, /Legacy\.tsx:2 — `tabIndex`/);
    assert.doesNotMatch(context, /color pair/);
  });

  it('flags a new CSS file but not a tracked one or theme.css', () => {
    assert.match(check(repo.write('src/feature/new.css', '.a{}')), /new CSS file/);
    assert.equal(check(repo.write('src/theme.css', ':root{}')), '');

    const tracked = repo.write('src/feature/old.css', '.a{}');
    repo.commit();
    assert.equal(check(tracked), '');
  });

  it('audits a whole file with --all', () => {
    const path = repo.write('src/feature/Audit.tsx', 'const a = <img src="a.png" />;\n');
    assert.match(
      run('check-ui-conventions.mjs', '', { args: ['--all', path], cwd: repo.root }).stdout,
      /without `alt`/
    );
  });
});

describe('check-new-component-tests', () => {
  let repo;
  before(() => {
    repo = createRepo();
  });
  after(() => repo.cleanup());

  const stop = (extra = {}) => run('check-new-component-tests.mjs', { cwd: repo.root, ...extra });

  it('asks for a test when a new component has none', () => {
    repo.write('src/feature/Widget.tsx', 'export const Widget = () => null;\n');
    const { code, stdout } = stop();
    assert.equal(code, 0);
    const output = JSON.parse(stdout);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /src\/feature\/Widget\.tsx/);
  });

  it('stays quiet while stop_hook_active is set', () => {
    assert.equal(stop({ stop_hook_active: true }).stdout, '');
  });

  it('asks when the test has no a11y check', () => {
    repo.write('src/feature/Widget.test.tsx', "it('renders', () => {});\n");
    assert.match(stop().stdout, /Widget\.tsx/);
  });

  it('is quiet once the test runs an a11y check', () => {
    repo.write(
      'src/feature/Widget.test.tsx',
      "it('has no a11y violations', async () => { expect(await axe(container)).toHaveNoViolations(); });\n"
    );
    assert.equal(stop().stdout, '');
  });

  it('ignores hooks, stories, files outside sourceRoots and committed components', () => {
    repo.write('src/feature/useThing.tsx', 'export const useThing = () => null;\n');
    repo.write('src/feature/Widget.stories.tsx', 'export default {};\n');
    repo.write('scripts/Tool.tsx', 'export const Tool = () => null;\n');
    repo.commit();
    repo.write('src/feature/Widget.test.tsx', "it('x', () => {});\n");
    assert.equal(stop().stdout, '');
  });

  it('asks about a staged component that is not committed', () => {
    repo.write('src/feature/Staged.tsx', 'export const Staged = () => null;\n');
    repo.git('add', '-A');
    assert.match(stop().stdout, /Staged\.tsx/);
    repo.commit();
  });

  it('stops asking once the component is committed, even when origin/main is behind', () => {
    repo.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    repo.write('src/feature/Wrapper.tsx', 'export const Wrapper = () => null;\n');
    assert.match(stop().stdout, /Wrapper\.tsx/);
    repo.commit();
    assert.equal(stop().stdout, '');
  });

  it('is quiet outside a git repo', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'web-kit-hooks-nogit-')));
    assert.equal(run('check-new-component-tests.mjs', { cwd: dir }, { cwd: dir }).stdout, '');
    rmSync(dir, { recursive: true, force: true });
  });
});
