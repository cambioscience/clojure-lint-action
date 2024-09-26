const core = require('@actions/core');
const { spawn } = require('child_process');
const spawnargs = require('./spawnargs');

async function cljKondo(argString) {
    let args = spawnargs(argString);
    return new Promise((resolve, _reject) => {
        let result = {
            stdout: '',
            stderr: '',
            statusCode: null
        };
        const cliArgs = [...args, '--config', '"{:output {:format :json}}"'];
        core.debug(`About to run clj-kondo like this: 'clj-kondo ${cliArgs.join(' ')}`);
        const kondo = spawn('clj-kondo', cliArgs, {
            shell: true
        });
        kondo.stdout.on('data', data => {
            result.stdout += data.toString();
        });
        kondo.stderr.on('data', data => {
            result.stderr += data.toString();
        });
        kondo.on('close', code => {
            result.exitCode = code;
            core.debug(`Stdout of clj-kondo: ${result.stdout}`);
            core.debug(`Stderr of clj-kondo: ${result.stderr}`);
            result.stdout = JSON.parse(result.stdout);
            resolve(result);
        });
    });
}

module.exports = cljKondo;
