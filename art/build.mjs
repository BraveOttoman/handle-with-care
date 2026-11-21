// npm run art [-- --quick]
// Exports the layout, then runs the Blender scripts with a Python that has `bpy`
// (pip install bpy, Python 3.13). Set BLENDER_PYTHON to pick which python to use.
import { spawnSync } from 'node:child_process';

const py = process.env.BLENDER_PYTHON || 'python3';
const extra = process.argv.slice(2);
const run = (cmd, args) => {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run('node', ['art/export-layout.mjs']);
run(py, ['art/build_props.py', ...extra]);
run(py, ['art/build_mansion.py', ...extra]);
