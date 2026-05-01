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
	if (filePath.endsWith('pnpm-lock.yaml')) {
		process.stderr.write('Block: edit pnpm-lock.yaml via pnpm install, not directly\n')
		process.exit(2)
	}
}

main()
