require('babel/register');

var Bot = require('./bot');
var bot = new Bot('YOUR-TOKEN-GOES-HERE');
bot.login();
