const { execFileSync } = require('child_process');

const title = 'Improve dashboard month-end balances, rebates, and report defaults.';
const body =
  'Add month-end to receive/pay analytics from ledger closing balances, relax rebate month selection, default profit and sales lists to today, branch-scoped sale/purchase APIs, and demo seed npm scripts.';

const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
const parent = execFileSync('git', ['rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim();
const oldHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Bilal-Hassan-Mughal',
  GIT_AUTHOR_EMAIL: 'ittefaqironstore5@gmail.com',
  GIT_COMMITTER_NAME: 'Bilal-Hassan-Mughal',
  GIT_COMMITTER_EMAIL: 'ittefaqironstore5@gmail.com',
};

const newHash = execFileSync(
  'git',
  ['commit-tree', tree, '-p', parent, '-m', title, '-m', body],
  { encoding: 'utf8', env }
).trim();

execFileSync('git', ['update-ref', 'refs/heads/main', newHash, oldHead], { stdio: 'inherit' });
console.log('Updated main:', oldHead.slice(0, 7), '->', newHash.slice(0, 7));
execFileSync('git', ['log', '-1', '--format=full'], { stdio: 'inherit' });
