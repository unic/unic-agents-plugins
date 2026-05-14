// @ts-check
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertIssuesToPrd } from './lib/issues-to-prd-json.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INPUT_DIR = join(REPO_ROOT, 'docs', 'issues', 'unic-archon-dlc')
const OUTPUT_PATH = join(REPO_ROOT, 'docs', 'workflow', 'unic-archon-dlc', 'prd.json')

async function main() {
	const entries = await readdir(INPUT_DIR)
	const issueFiles = entries.filter((name) => /^\d{2}-.+\.md$/.test(name)).sort()
	const files = await Promise.all(
		issueFiles.map(async (filename) => ({
			filename,
			content: await readFile(join(INPUT_DIR, filename), 'utf8'),
		})),
	)
	const prd = convertIssuesToPrd(files)
	await mkdir(dirname(OUTPUT_PATH), { recursive: true })
	await writeFile(OUTPUT_PATH, `${JSON.stringify(prd, null, 2)}\n`, 'utf8')
	process.stdout.write(`Wrote ${prd.stories.length} stories to ${relative(REPO_ROOT, OUTPUT_PATH)}\n`)
}

main().catch((err) => {
	process.stderr.write(`${err.stack ?? err.message ?? String(err)}\n`)
	process.exit(1)
})
