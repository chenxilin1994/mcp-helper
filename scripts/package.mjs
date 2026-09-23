import { spawnSync } from 'node:child_process'

const env = {
  ...process.env,
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
  ELECTRON_BUILDER_BINARIES_MIRROR:
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR ?? 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: true })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npx', ['electron-vite', 'build'])
run('npx', ['electron-builder', '--win'])
console.log('\npackaged: release/  (installer + portable + win-unpacked)')
