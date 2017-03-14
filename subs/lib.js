var request = require("request");

function registerSubBot(url, luisAppId, subKey) {
  var mainControl = "http://localhost:3978/api/control";
  var options =  {
    uri:mainControl,
    method: 'POST',
    json: {
      type:'luis', 
      endpoint:url, 
      luisAppId:luisAppId, 
      subKey:subKey
    }
  };
  request(options, function(err, response, body) {
  });
}

module.exports = { 
  registerSubBot 
};
