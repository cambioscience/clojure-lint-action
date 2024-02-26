const fs = require('fs');
const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');

const request = require('./request');
const cljKondo = require('./clj_kondo');
const parsePatch = require('./parse_patch');

const {
    GITHUB_SHA,
    GITHUB_OUTPUT,
    GITHUB_EVENT_PATH,
    INPUT_GITHUB_TOKEN,
    GITHUB_WORKSPACE,
    GITHUB_REPOSITORY
} = process.env;
const cljKondoArgs = process.env.LINT_ARGS;
const checkName = process.env.CHECK_NAME;
const levels = (process.env.LEVELS || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length);
const fileStatuses = (process.env.FILE_STATUSES || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length);
const fileMatch = process.env.FILE_MATCH || '';

// Mostly taken from https://github.com/jitterbit/get-changed-files/blob/master/src/main.ts
async function getModifiedFiles() {
    if (!fileStatuses.length) {
        core.info(`No file-statuses defined, no levels will be raised to errors`);
        return [];
    }
    let base, head;
    switch (context.eventName) {
        case 'pull_request':
            base = context.payload.pull_request?.base?.sha;
            head = context.payload.pull_request?.head?.sha;
            break;
        case 'push':
            base = context.payload.before;
            head = context.payload.after;
            break;
        default:
            core.setFailed(
                `This action only supports pull requests and pushes, ${context.eventName} events are not supported. ` +
                    "Please submit an issue on this action's GitHub repo if you believe this in correct."
            );
    }
    core.info(`Base: ${base}, Head: ${head}`);

    const { owner, repo } = context.repo;

    const client = new GitHub(INPUT_GITHUB_TOKEN);
    const response = await client.repos.compareCommits({ base, head, owner, repo });

    if (response.status !== 200) {
        core.setFailed(
            `The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200. ` +
                "Please submit an issue on this action's GitHub repo."
        );
    }

    let modifiedFiles = {}; // fileName:string -> addedLines:int[]
    for (const file of response.data.files) {
        const { filename, patch, status } = file;
        if (filename.includes(':')) {
            core.error(`One of your files (${filename}) includes a colon ':'. It will be skipped.`);
        } else if (patch && fileStatuses.includes(status)) {
            modifiedFiles[filename] = parsePatch(patch)
                .filter(lineChange => lineChange.added)
                .map(lineChange => lineChange.lineNumber);
        } else {
            core.error(`Patch skipped for ${filename} (${status}): ${patch}`);
        }
    }
    core.debug(`Modified files: ${JSON.stringify(modifiedFiles)}`);
    return modifiedFiles;
}

const annotationLevels = {
    info: 'notice',
    warning: 'warning',
    error: 'failure'
};

async function run() {
    let output = '';
    let finalExitCode = 0;
    const modifiedFiles = await getModifiedFiles();
    const fileRegexp = fileMatch.trim().length ? new RegExp(fileMatch) : null;
    let { exitCode, stdout, stderr } = await cljKondo(cljKondoArgs);
    core.debug(
        `clj-kondo exitCode=${exitCode}, stderr=${stderr}, stdout.findings=${JSON.stringify(stdout.findings.length)}`
    );
    const oneOrMoreWarningsFound = exitCode === 2;
    const oneOrMoreErrorsFound = exitCode === 3;
    if (oneOrMoreWarningsFound || oneOrMoreErrorsFound) {
        let oneOrMoreMatchedLevelIsError = false;
        let allAnnotations = [];
        for (const f of stdout.findings) {
            const { filename, level, type, col, row, message } = f;
            const path = filename.replace(/^\.\//, '');
            const endRow = f['end-row'];
            const endCol = f['end-col'];
            const matchLevel = !levels.length || levels.includes(level);
            if (matchLevel) {
                const modified =
                    !fileStatuses.length ||
                    (modifiedFiles[path] || []).some(lineNumber => row >= lineNumber && endRow <= lineNumber);
                const matchName = !fileRegexp || fileRegexp.test(filename);
                const isError = level === 'error';
                const matchedLevelIsError = !isError && modified && matchName;
                const matchedLevel = matchedLevelIsError ? 'error' : level;
                oneOrMoreMatchedLevelIsError = oneOrMoreMatchedLevelIsError || matchedLevelIsError;
                let annotation = {
                    path,
                    start_line: row,
                    end_line: endRow,
                    annotation_level: annotationLevels[matchedLevel],
                    message: `[${type}] ${message}`
                };
                if (annotation['start_line'] == annotation['end_line']) {
                    annotation['start_column'] = col;
                    annotation['end_column'] = endCol;
                }
                if (isError || matchedLevelIsError) {
                    allAnnotations.push(annotation);
                    core.debug(`+ ${path}:${row}`);
                } else {
                    core.debug(`- ${path}:${row}, modified=${modified ? 1 : 0}, matchName=${matchName ? 1 : 0}`);
                }
            } else {
                core.debug(`- ${path}:${row}, matchLevel=${matchLevel ? 1 : 0}`);
            }
        }

        const finalStatus = oneOrMoreErrorsFound || oneOrMoreMatchedLevelIsError ? 'failure' : 'success';
        finalExitCode = oneOrMoreErrorsFound || oneOrMoreMatchedLevelIsError ? 1 : 0;
        const { duration, error, warning, info } = stdout.summary;
        const warningsAsErrors = allAnnotations.length - error;

        output += `status=${finalStatus}\n`;
        output += `summary=clj-kondo took:${duration}ms, errors: ${error}, warnings: ${warning} (${warningsAsErrors} are new in changed files), info: ${info}\n`;
        output += `annotations=${JSON.stringify(allAnnotations)}\n`;

        core.debug(
            `oneOrMoreErrorsFound: ${oneOrMoreErrorsFound}, oneOrMoreMatchedLevelIsError: ${oneOrMoreMatchedLevelIsError}, output: ${output}`
        );
    } else if (exitCode == 0) {
        output += `status=success\n`;
        finalExitCode = 0;
    } else {
        output += `status=failure\n`;
        finalExitCode = 1;
    }
    fs.writeFileSync(GITHUB_OUTPUT, output);
    process.exit(finalExitCode);
}

run();
