'use strict';

var request = require('request');
var restify = require('restify');
var builder = require('botbuilder');
var nconf = require('nconf');

var _focusBot = null;
var _defaultRoute = null;

// Map of subbots to recognisers
var _subs = {};
function control(req, res, next) {
  var json = req.body;
  // RL: body would be signed and encrypted
  if (json.type === "luis") {
    _subs[json.endpoint] = [json.luisAppId, json.subKey];
  }
  next();
}

/* Real version
function askLuis(appId, subKey, q, endpoint) {
  var uri = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${appId}?subscription-key=${subKey}&verbose=true&q=${q}`;
  return new Promise((resolve, reject) => {
    var options = {
      uri: uri,
      method : 'GET'
    };
    request(options, (err, response, body) => {
      resolve([endpoint, response]);
    })
  });
}
*/

// Mock version
function askLUIS(appId, subKey, q, endpoint) {
  return new Promise((resolve, reject) => {
    var result = { topScoringIntent: { intent : "None", score : 0.9 } };
    if (q.indexOf('time') != -1) {
      if (endpoint.indexOf("time") != -1) {
        result.topScoringIntent.intent = "whatTimeIsIt";
        result.topScoringIntent.score = 0.89;
      }
    }
    else if (q.indexOf('date') != -1) {
      if (endpoint.indexOf("date") != -1) {
        result.topScoringIntent.intent = "whatDateIsIt";
        result.topScoringIntent.score = 0.85;
      }
    }
    resolve([endpoint, result]);  
  });
}

function routeToSub(uri, req) {

  var headers = {};
  headers.authorization = req.headers.authorization;

  return new Promise((resolve, reject) => {
    request({
      uri: uri,
      method : 'POST',
      json : true,
      body : req.body,
      headers : headers
    }, 
    (err, response, body) => {
      if (response) {
        console.log(response.statusCode);
        console.log(response.body);
      }
      resolve(response);
    })
  });
}

function router(req, res, next) {

  if (req.body.type != 'message') {
    res.end();
    next();
    return;
  }

  if (_focusBot != null) {
    routeToSub(_focusBot, req)
    .then((result) => {
      if (result) {
        result.pipe(res);
      }
      res.end();
      next();
      return;
    });
  }

  var tasks = [];
  for (var k in _subs) {
    tasks.push(askLUIS(_subs[k][0], _subs[k][1], req.body.text, k));
  }

  if (tasks.length == 0) {
    _defaultRoute(req, res, next);
    return;
  }

  Promise.all(tasks)
  .then((results) => {

    // Filter out 'None'
    var intents = results.filter((result) => { 
      return (result[1].topScoringIntent.intent != 'None'); }
    )

    if (intents.length) {

      // Find the top scoring intent
      var topIntent = intents.reduce((prev, curr) => { 
        return prev[1].topScoringIntent.score < curr[1].topScoringIntent.score ? prev : curr; 
      });

      // Set focus and route the 
      // request to the sub bot
      _focusBot = topIntent[0];
      routeToSub(_focusBot, req)
      .then((result) => {
        if (result) {
          result.pipe(res);
        }
        res.end();
        next();
        return;
      });
    }
    else {
      _defaultRoute(req, res, next);
      return;
    }
  });
}

function main() {

  var config = nconf.env().argv().file({file:'localConfig.json', search:true});

  var server = restify.createServer();
  server.use(restify.bodyParser({ mapParams: false }));
  server.listen(config.get("port") || config.get("PORT") || 3978, function () {
     console.log('%s listening to %s', server.name, server.url); 
  });

  var connector = new builder.ChatConnector({
    appId: config.get("MICROSOFT_APP_ID"),
    appPassword: config.get("MICROSOFT_APP_PASSWORD")
  });

  _defaultRoute = connector.listen();
  server.post('/api/messages', router);
  server.post('/api/control', control);

  var bot = new builder.UniversalBot(connector);
  bot.dialog('/', [
    (session, args) => {
      session.send('mainBot: no suitable handler found (subs:' + Object.keys(_subs).length + ')');
    }
  ]);
}

main();
