var co      = require('co')
var channel = require('chanel') // don't need maybe?
var reset   = require('yield-ratelimit-reset') // not sure how to integrate?
var request = require('co-request')

var valid_color = /^([0-9A-F]{3}$|[0-9A-F]{6}$)/i

var GITHUB_USERNAME  = process.env.GITHUB_USERNAME
var GITHUB_PASSWORD  = process.env.GITHUB_PASSWORD
var GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN

var auth

if (GITHUB_API_TOKEN) {
  auth = {
      user: GITHUB_API_TOKEN
    , pass:'x-oauth-basic'
  }
} else if (GITHUB_USERNAME && GITHUB_PASSWORD) {
  auth = {
      user: GITHUB_USERNAME
    , pass: GITHUB_PASSWORD
  }
} else {
  throw new Error('requires a personal env.GITHUB_API_TOKEN or both env.GITHUB_USERNAME and env.GITHUB_PASSWORD')
}

module.exports = labels

function* labels(args, opts) {
  var org   = args[0]
  var label = args[1]
  var color = args[2]

  //var state = {}
  //process.on('uncaughtException', onError) // maybe add this back in when you are sure your (my?) syntax is correct lol
  console.log('\norganization: ' + org
            + '\nlabel: ' + label
            + '\ncolor: #' + color
            + '\nmethod: ' + opts._method
            + '\n')

  if (!org || 'string' != typeof org)
    throw new TypeError('an organization must be defined: <org> <label> <color>')

  if (!label || 'string' != typeof label)
    throw new TypeError('a label name must be defined: <org> <label> <color>')

  if (!opts.method === 'DELETE' && (!color || 'string' != typeof color))
    throw new TypeError('a color must be defined: <org> <label> <color>')

  if (!opts.method === 'DELETE' && !valid_color.test(color))
    throw new TypeError('color must be a valid hex color code without the \'#\': 09aF00')


  var res = yield request({
        url:     'https://api.github.com/orgs/' + org + '/repos'
      , headers: { "User-Agent": GITHUB_USERNAME || "org-tagger" }
      , auth:    auth
      , json:    true
    })
  if (res.statusCode !== 200) throw new Error('error searching org\'s repos: ' + JSON.stringify(res.headers) +'\n')

  console.log('found %d repositories in %s\n', res.body.length, org)

  var i     = res.body.length
  var repos = []
  while (i--) {
    repos.push(res.body[i].name)
  }

  var json_out = {
      name:  label
    , color: color
  }
  var url = 'https://api.github.com/repos/' + org + '/:repo/labels'

  var results = yield* update_labels(url, repos, opts._method, json_out)

  i = results.length
  while (i--) {
    var result = results[i]

    if (result.statusCode === 422)
      console.log('label "' + label + '" already exists at ' + result.request.path)

    else if (result.statusCode === 200)
      console.log('label "' + label + '" successfully updated at ' + result.request.path)

    else if (result.statusCode === 201)
      console.log('label "' + label + '" successfully created at ' + result.request.path)

    else if (result.statusCode === 204)
      console.log('label "' + label + '" successfully deleted from ' + result.request.path)

    else {
      console.log(result.request.path)
      console.log('status: ' + result.statusCode)
      if (result.body) console.log(result.body)
    }
  }

  console.log('\nGitHub rate limit remaining: ' + res.headers['x-ratelimit-remaining'])

  console.log('done updating labels')

  // not really sure how this error handler works; remove?
  /*process.removeListener('uncaughtException', onError)

  function onError() {
    console.error('ERR!')
    Object.keys(state).forEach(function (repo) {
      state[repo] = Date.now() - state[repo]
    })
    console.log(JSON.stringify(state, null, 2))
    setImmediate(function () {
      process.exit()
    })
  }*/
}

function* update_labels(url, repos, method, json) {
  var arr = []
  var i   = repos.length

  while (i--) {
    arr.push(request({
        url:     url.replace(/:repo/, repos[i]) + (method !== 'POST' ? '/' + json.name : '')
      , headers: { 'User-Agent': GITHUB_USERNAME || 'org-tagger' }
      , method:  method
      , json:    json
      , auth:    auth
    }))
  }

  return yield arr
}
