import {
  appendGitHubOutput,
  appendGitHubSummary,
  formatValidationSummary,
  loadPackageJson,
  resolveReleaseContext,
  validateReleaseFields
} from './core.mjs';

function parseArgs(argv) {
  const args = {
    skipReleaseNotes: false,
    tag: null
  };

  for (const arg of argv) {
    if (arg === '--skip-release-notes' || arg === '--skip-release-notes=true') {
      args.skipReleaseNotes = true;
      continue;
    }

    if (arg === '--skip-release-notes=false') {
      args.skipReleaseNotes = false;
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

try {
  const args = parseArgs(process.argv.slice(2));
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
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await appendGitHubSummary(
    ['## Release validation', '', `- Validation: failed`, `- Error: ${message}`, ''].join('\n')
  );
  console.error(`release validation failed: ${message}`);
  process.exit(1);
}
