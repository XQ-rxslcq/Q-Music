#!/usr/bin/env node
/** 开发前轻量检查：主路径要求 Node >= 18；推荐 24。 */
const major = Number(process.versions.node.split('.')[0])
if (Number.isNaN(major) || major < 18) {
  console.error(
    `[Q-Music] 当前 Node ${process.versions.node} 过低。\n` +
      `请切换到 Node >= 18（推荐 24，见 .node-version）。\n` +
      `若暂时无法升级，可试：npm run dev:compat`,
  )
  process.exit(1)
}
if (major < 20) {
  console.warn(
    `[Q-Music] 提示：当前 Node ${process.versions.node} 可用，但推荐使用 Node 24（你的常用版本）。`,
  )
}
