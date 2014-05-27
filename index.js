var request = require('co-request')

/*
 * checks that a string is a valid hex color code without the preceding `#`
 */
var valid_color = /^([0-9A-F]{3}$|[0-9A-F]{6}$)/i

/*
 * GitHub api requires a `User-Agent` header.
 */
var header = { 'User-Agent': 'org-labels' }

/*
 * GitHub auth variables.
 * Set either user+pass or just the token (recommended) in your environment
 *  before running this tool.
 *
 * The token is just a user access token, you can generate a new token
 *  in your GitHub Account Settings, under the Security tab.
 */
var GITHUB_USERNAME  = process.env.GITHUB_USERNAME
var GITHUB_PASSWORD  = process.env.GITHUB_PASSWORD
var GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN

var auth

if (GITHUB_API_TOKEN) {
  auth = {
      user: GITHUB_API_TOKEN
    , pass: 'x-oauth-basic'
  }
} else if (GITHUB_USERNAME && GITHUB_PASSWORD) {
  auth = {
      user: GITHUB_USERNAME
    , pass: GITHUB_PASSWORD
  }
} else {
  throw new Error('requires a personal env.GITHUB_API_TOKEN or both env.GITHUB_USERNAME and env.GITHUB_PASSWORD')
}


module.exports.add    = add
module.exports.remove = remove
module.exports.update = update
module.exports.rename = rename
module.exports.standardize = standardize

/*
 * Adds a label with the specified name and color to all repos in an org.
 */
function* add(args, program) {
  var org   = args[0]
  var label = args[1]
  var color = args[2]

  if (!valid_color.test(color))
    throw new TypeError('color must be a valid hex color code without the \'#\': 09aF00')

  return yield* handle_label(org, 'POST', { name: label, color: color }, 'done adding labels')
}

/*
 * Removes a label with the specified name from all repos in an org.
 */
function* remove(args, program) {
  var org   = args[0]
  var label = args[1]

  return yield* handle_label(org, 'DELETE', { name: label, ext: label }, 'done removing labels')
}

/*
 * Updates an existing label with the specified name to the specified color for all repos in an org.
 */
function* update(args, program) {
  var org   = args[0]
  var label = args[1]
  var color = args[2]

  if (!valid_color.test(color))
    throw new TypeError('color must be a valid hex color code without the \'#\': 09aF00')

  return yield* handle_label(org, 'PATCH', { name: label, color: color, ext: label }, 'done updating labels')
}

/*
 * Renames an existing label with the specified revised name for all repos in an org.
 */
function* rename(args, program) {
  var org       = args[0]
  var label     = args[1]
  var new_label = args[2]

  return yield* handle_label(org, 'PATCH', { name: new_label, ext: label }, 'done renaming labels')
}

/*
 * Standardizes a json list of labels across all repos in an org.
 *
 * The json list must reside in a repo at config/github_labels.json
 */
function* standardize(args, program) {
  var org         = args[0]
  var config_repo = args[1]

  // if the config_repo isn't a user/repo path, make it one.
  if (!~config_repo.indexOf('/')) {
    config_repo = org + '/' + config_repo
  }

  var repos = yield* get_repos(org)

  var res = yield request({
        uri:     'https://api.github.com/repos/' + config_repo + '/contents/config/github_labels.json'
      , headers: header
      , auth:    auth
      , json:    true
    })
  if (res.statusCode !== 200) throw new Error('error retrieving config from repo: ' + JSON.stringify(res.headers) +'\n')

  console.log('GitHub rate limit remaining: ' + res.headers['x-ratelimit-remaining'])

  // github sends the body (json file) as base64
  var config = JSON.parse(new Buffer(res.body.content, 'base64').toString('utf8'))
  if (!Array.isArray(config))
    throw new Error('error: github_labels.json must be a json array')

  console.log('checking %d labels across %d repos', config.length, repos.length)

  var i    = repos.length
  var reqs = []
  while (i--) {
    reqs.push(handle_repo_labels(org, repos[i], config, program.destructive))
  }
  var results = yield reqs

  var total = log_results(results)

  console.log('%d label updates across %d repos', total, repos.length)
  console.log('done standardizing labels')
}

/*
 * Handles differences between existing labels and a config list of labels.
 *
 * returns an array of responses
 */
function* handle_repo_labels(org, repo, config, destructive) {

  var uri = 'https://api.github.com/repos/' + org + '/' + repo + '/labels'
  var res = yield request({
      uri:     uri
    , headers: header
    , method:  'GET'
    , json:    true
    , auth:    auth
  })
  if (res.statusCode !== 200) throw new Error('error getting labels from a repo: ' + JSON.stringify(res.headers) +'\n')

  var list = compare_labels(config, res.body, destructive)

  var results = []

  var i = list.length
  while (i--) {
    item = list[i]

    results.push(request({
        uri:     uri + (item.method === 'POST' ? '' : '/' + item.name)
      , headers: header
      , method:  item.method
      , json:    item
      , auth:    auth
    }))
  }

  return yield results
}

/*
 * Compares two lists of labels and determines the differences.
 *
 * returns a list of objects containing the needed JSON body and http method.
 */
function compare_labels(config, _existing, destructive) {
  var out = []
  var i   = config.length
  // don't splice the actual array
  var existing = _existing.slice(0)

  while (i--) {
    var wanted = config[i]
    var next   = false
    var j      = existing.length
    var current

    while (j--) {
      current = existing[j]
      if (wanted.name !== current.name) continue

      existing.splice(j, 1)
      next = {
          name:   wanted.name
        , color:  wanted.color
        , method: 'PATCH'
      }
      break
    }
    if (next && wanted.color === current.color) continue

    out.push(next || {
        name:   wanted.name
      , color:  wanted.color
      , method: 'POST'
    })
  }

  i = existing.length
  while (destructive && i--) {
    out.push({
        name:   existing[i].name
      , method: 'DELETE'
    })
  }

  return out
}

/*
 * Gets information about all of a GitHub organization's repos.
 *
 * returns a list of repos
 */
function* get_repos(org) {
  var repos = []
  var page  = 0
  var last_length = 0

  // handle github pagination for orgs with many repos
  while (++page) {
    var res = yield request({
        uri:     'https://api.github.com/users/' + org + '/repos?page=' + page
      , headers: header
      , auth:    auth
      , json:    true
    })
    if (res.statusCode !== 200) throw new Error('error searching org\'s repos: ' + JSON.stringify(res.headers) +'\n')

    var i = res.body.length
    while (i--) {
      repos.push(res.body[i].name)
    }

    // if this page has less repos than the last, then it is the last page.
    if (res.body.length < last_length) break

    last_length = res.body.length
  }

  console.log('found %d repositories in %s\n', repos.length, org)

  return repos
}

/*
 * Handles getting repos and sending requests for single-label commands.
 *
 * See `send_label` for options
 *
 * returns an array of responses
 */
function* handle_label(org, method, opts, done) {
  var repos   = yield* get_repos(org)
  var results = yield* send_label(org, repos, opts, method)

  var i = results.length
  while (i--) {
     log_result(results[i], opts.name)
  }

  if (done) console.log(done)

  return yield results
}

/*
 * Applies a label via method & options to all repos.
 *
 * Options can contain:
 *   - The outgoing json, sent as the entire options.
 *   - The uri extension.
 *   - The http method, if not otherwise specified.
 *
 * returns an array of responses
 */
function* send_label(org, repos, opts, method) {
  var arr = []
  var i   = repos.length
  var uri = 'https://api.github.com/repos/' + org + '/'

  while (i--) {
    arr.push(request({
        uri:     uri + repos[i] + '/labels' + (opts.ext ? '/' + opts.ext : '')
      , headers: header
      , method:  method || opts.method
      , json:    opts
      , auth:    auth
    }))
  }

  return yield arr
}

/*
 * Logs a two-dimensional [][] array of results.results
 *
 * returns the total number of results
 */
function log_results(results) {
  var total = 0
  var i     = results.length

  while (i--) {
    var sub = results[i]
    var j   = sub.length

    while (j--) {
      total++
      log_result(sub[j])
    }
  }

  return total
}

/*
 * Logs a single response object.
 */
function log_result(result, label) {
  label = label || (result.body && result.body.name)
  // delete requests to github do not return bodies ..
  if (!label) {
    var path = result.request.path
    label = path.slice(path.lastIndexOf('/') + 1)
  }

  if (result.statusCode === 422)
    console.log('label `' + label + '` already exists at ' + result.request.path)

  else if (result.statusCode === 200)
    console.log('label `' + label + '` successfully updated at ' + result.request.path)

  else if (result.statusCode === 201)
    console.log('label `' + label + '` successfully created at ' + result.request.path)

  else if (result.statusCode === 204)
    console.log('label `' + label + '` successfully deleted from ' + result.request.path)

  else {
    if (result.request.path) console.log(result.request.path)
    console.log('status: ' + result.statusCode)
    if (result.body) console.log(result.body)
  }
}
