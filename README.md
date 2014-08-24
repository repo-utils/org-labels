# org-labels

[![NPM Version](https://img.shields.io/npm/v/org-labels.svg?style=flat)](https://www.npmjs.org/package/org-labels)
[![NPM Downloads](https://img.shields.io/npm/dm/org-labels.svg?style=flat)](https://www.npmjs.org/package/org-labels)
[![Node.js Version](https://img.shields.io/badge/node.js->=_0.11-orange.svg?style=flat)](http://nodejs.org/download/)

A tool to help manage organization-wide GitHub issue labels.

### Installation

```bash
$ npm install -g org-labels
```

## Usage

Requires node.js 0.11+ - use a node version manager [such as __n__](https://www.npmjs.org/package/n) to switch versions easily.

Requires a GITHUB_API_TOKEN environment variable. - use [set-env](https://www.npmjs.org/package/set-env) to easily set it. This token must be a [GitHub Personal API Token](https://github.com/blog/1509-personal-api-tokens). It must have either `repo` or at least `public_repo` access.

```bash
$ sudo n 0.11.13

$ org-labels <command>
```

### Commands

- `add` `<org> <label> <color>` - adds a label to all repos.
- `remove` `<org> <label>` - removes a label from all repos.
- `update` `<org> <label> <color>` - updates an existing label for all repos.
- `rename` `<org> <label> <new>` - renames an existing label for all repos.
- `standardize` `<org> <repo>` - reads a `config/github_labels.json` file from a repo and adds / updates labels on all repos.

__color__ must be a hexadecimal color code without the preceding `#`.

Both `<org>` and `<repo>` may optionally be formated as `<org/repo>`.

#### Options

- `-d` `--destructive` - When enabled, allows `standardize` to remove labels not found in the config file.

## Example

The following would add a `docs` issue label with the color `d4c5f9` to every repo in `repo-utils`.

```bash
$ org-labels add repo-utils docs d4c5f9
```

## [MIT Licensed](LICENSE)
