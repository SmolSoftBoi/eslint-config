import {
  appendGitHubOutput,
  appendGitHubSummary,
  formatValidationSummary,
  loadPackageJson,
  resolveReleaseContext,
  validateReleaseFields
} from './core.mjs';
import { pathToFileURL } from 'node:url';

export function parseArgs(argv) {
  const args = {
    skipReleaseNotes: false,
    tag: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--skip-release-notes' || arg === '--skip-release-notes=true') {
      args.skipReleaseNotes = true;
      continue;
    }

    if (arg === '--skip-release-notes=false') {
      args.skipReleaseNotes = false;
      continue;
    }

    if (arg === '--tag') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--tag option requires a value, e.g. --tag v1.2.3');
      }

      args.tag = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--tag=')) {
      args.tag = arg.slice('--tag='.length);
      continue;
    }

    throw new Error(`Unknown release validation argument: ${arg}`);
  }

  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const pkg = await loadPackageJson();
  const context = await resolveReleaseContext({
    skipReleaseNotes: args.skipReleaseNotes,
    tag: args.tag
  });

  const result = validateReleaseFields({
    packageName: pkg.name,
    packageVersion: pkg.version,
    releaseBody: context.releaseBody,
    requireReleaseNotes: context.requireReleaseNotes,
    tag: context.tag
  });

  const summaryResult = {
    ...result,
    releaseNotesStatus: context.releaseNotesStatus,
    validationStatus: 'passed'
  };

  await appendGitHubOutput({
    npm_access: result.npmAccess,
    npm_dist_tag: result.npmDistTag,
    package_name: result.packageName,
    release_tag: result.tag,
    release_version: result.version
  });
  await appendGitHubSummary(formatValidationSummary(summaryResult));

  console.log(
    `Release validation passed for ${result.packageName} ${result.tag}; npm dist-tag: ${result.npmDistTag}.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendGitHubSummary(
      ['## Release validation', '', `- Validation: failed`, `- Error: ${message}`, ''].join('\n')
    );
    console.error(`release validation failed: ${message}`);
    process.exit(1);
  }
}
