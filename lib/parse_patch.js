// this is a partial extract from https://github.com/dherault/parse-git-patch/blob/master/src/index.ts#L82C5-L82C19
// because patch sections of compare commit api is skipping `diff --git` and file metadata parts
// github has a way to fetch a parse-able format
// `curl -H "Accept: application/vnd.github.v3.diff" -H "Authorization: Bearer ghp_" https://api.github.com/repos/:owner/:repo/pulls/:pull-request.diff`
// but is exists only in scope of a PR
function splitIntoParts(lines, separator) {
    const parts = [];
    let currentPart;

    lines.forEach(line => {
        if (line.startsWith(separator)) {
            if (currentPart) {
                parts.push(currentPart);
            }

            currentPart = [line];
        } else if (currentPart) {
            currentPart.push(line);
        }
    });

    if (currentPart) {
        parts.push(currentPart);
    }
    return parts;
}

const fileLinesRegex = /^@@ -([0-9]*),?\S* \+([0-9]*),?/;

function parsePatch(rawPatch) {
    const diff = rawPatch.split('\n');
    let modifiedLines = [];
    splitIntoParts(diff, '@@ ').forEach(lines => {
        const fileLinesLine = lines.shift();

        if (!fileLinesLine) return;

        const match4 = fileLinesLine.match(fileLinesRegex);

        if (!match4) return;

        const [, a, b] = match4;

        let nA = parseInt(a) - 1;
        let nB = parseInt(b) - 1;

        lines.forEach(line => {
            nA++;
            nB++;

            if (line.startsWith('-- ')) {
                return;
            }
            if (line.startsWith('+')) {
                nA--;

                modifiedLines.push({
                    added: true,
                    lineNumber: nB,
                    line: line.substr(1)
                });
            } else if (line.startsWith('-')) {
                nB--;

                modifiedLines.push({
                    added: false,
                    lineNumber: nA,
                    line: line.substr(1)
                });
            }
        });
    });
    return modifiedLines;
}

module.exports = parsePatch;
