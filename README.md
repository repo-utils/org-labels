# org-labels

[![NPM Version](https://img.shields.io/npm/v/org-labels.svg?style=flat)](https://www.npmjs.org/package/org-labels)
[![NPM Downloads](https://img.shields.io/npm/dm/org-labels.svg?style=flat)](https://www.npmjs.org/package/org-labels)
[![Node.js Version](https://img.shields.io/badge/io.js->=_1.1.0-orange.svg?style=flat)](http://nodejs.org/download/)

A tool to help manage organization-wide GitHub issue labels.

### Installation

```bash
$ npm install -g org-labels
```

## Usage

```bash
$ org-labels <command>
```

Requires [io.js](https://iojs.org/en/index.html) 1.1.0+ — you can use a node version manager [such as __nvm__](https://github.com/creationix/nvm) to switch node versions easily.

#### GitHub Security

org-labels uses [`ghuath`](https://github.com/rvagg/ghauth) for GitHub authentication.
The version is fixed, and I have done a rough review of its code.

### Commands

- `add` `<org> <label> <color>` - adds a label to all repos.
- `remove` `<org> <label>` - removes a label from all repos.
- `update` `<org> <label> <color>` - updates an existing label for all repos.
- `rename` `<org> <label> <new>` - renames an existing label for all repos.
- `standardize` `<org> <repo>` - reads a `config/github_labels.json` file from a repo and adds / updates labels on all repos.

__color__ must be a hexadecimal color code without the preceding `#`.

Both `<org>` and `<repo>` may optionally be formatted as `<org/repo>`.

#### Options

- `-d` `--destructive` - When enabled, allows `standardize` to remove labels not found in the config file.

## Examples

The following would add a `docs` issue label with the color `d4c5f9` to every repo in `repo-utils`.

```bash
$ org-labels add repo-utils docs d4c5f9
```

The following would standardize labels in all `repo-utils` repos using the [jshttp labels config](https://github.com/jshttp/style-guide/tree/master/config).

```bash
$ org-labels standardize repo-utils jshttp/style-guide
```

## [MIT Licensed](LICENSE)
