# Clojure Lint Action (using clj-kondo)

Run clj-kondo and annotate source code changes with results.

## Fork Differences

This fork includes a couple of useful additions selected from mainstream forks:

- Allows specifying the clj-kondo version via GitHub Action input.
- Updates the Dockerfile to use clj-kondo $VERSION.

Additionally, it introduces more (**breaking**) changes for the main purpose: being **unobtrusive**. This is useful when using this linter at a late stage in a project that has a lot of warnings. The new behavior focuses on annotating only a subset of those warnings, i.e., new ones and those existing in the changed lines.

It also abandons the idea of publishing the annotations with the GitHub API on its own and only utilizes GitHub Actions outputs. In order to actually publish the check results, **you must have another step** to publish the results.

## Usage

```yaml
    steps:
    - uses: actions/checkout@v1
    - uses: cambioscience/clojure-lint-action@master
      with:
        # required to use GitHub api to fetch the commit difference to calculate the patch
        github_token: ${{ secrets.GITHUB_TOKEN }}
        clj-kondo-args: --lint src
        # optional
        check-name: clj-kondo
        # publish annotations only if file in PR is (also "removed"):
        file-statuses: added, modified
        # publish annotations only if relative file name (e.g. `src/folder/file.clj`) matches
        file-match: .clj(c)?$
        # publish annotations only if clj-kondo
        # i.e. you may tune the clj-kondo config to `:error`
        # {:linters {:unused-value {:level :error}}}
        # and leave only `error` here to skip new/modified warnings
        levels: warning, error
    - uses: LouisBrunner/checks-action@v1.6.1
      if: always()
      with:
        # secrets.GITHUB_TOKEN is needed here
        # to publish annotations back to github
        # this action is not storing or sending it anywhere
        token: ${{ secrets.GITHUB_TOKEN }}
        name: clj-kondo
        conclusion: ${{ job.status }}
        output: {"summary":"${{ steps.lint.outputs.summary }}"}
        annotations: ${{ steps.lint.outputs.annotations }}
```

![Annotation example](images/annotation.png)

![Check Run example](images/check-run.png)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
