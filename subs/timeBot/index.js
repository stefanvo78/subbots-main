var lib = require("../lib.js");
var restify = require("restify");
var builder = require("botbuilder");

function main() {

  // What time is it ?

  var url = 'http://localhost:3980/api/messages';
  lib.registerSubBot(url, null, null);

  var server = restify.createServer();
  server.use(restify.bodyParser({ mapParams: false }));
  server.listen(3980, function () {
     console.log('%s listening to %s', server.name, server.url); 
  });

  var connector = new builder.ChatConnector({
      appId: process.env.MICROSOFT_APP_ID,
      appPassword: process.env.MICROSOFT_APP_PASSWORD
  });

  server.post('/api/messages', connector.listen());
  
  var bot = new builder.UniversalBot(connector);
  bot.dialog('/', [
    (session, args) => {
      session.send('timeBot: The time is ' + new Date().toTimeString());
    }
  ]);
}

if (require.main === module) {
	main();
}
