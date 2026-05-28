#!/usr/bin/env node
// @ts-check
async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		return
	}

	const filePath = event?.tool_input?.file_path ?? ''
	if (/(^|\/)apps\/claude-code\/pr-review(\/|$)/.test(filePath)) {
		process.stderr.write(
			'Block: apps/claude-code/pr-review/ is off-limits for unic-pr-review work. Clean-slate doctrine — write from the PRD and ADRs, not the legacy pr-review plugin.\n',
		)
		process.exit(2)
	}
}

main()
