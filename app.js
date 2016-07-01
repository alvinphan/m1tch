/**
 * Created by phan on 5/14/16.
 */

var http = require("http");
var Discord = require("discord.js");
var AuthDetails =  require("./auth.json");

var Snoocore = require('snoocore');
var TwitchAPI = require('twitch-api');
var urban = require('urban');

var bot = new Discord.Client();
var identifier = "!"; // what symbol to preface bot commands, future: should be adjustable
var commands = new Object();

var reddit = new Snoocore({
	userAgent: 'DiscordBot by m1tch',
	throttle: 300,
	oauth: {
		type: 'script',
		key: AuthDetails.reddit_key,
		secret: AuthDetails.reddit_secret,
		username: AuthDetails.reddit_username,
		password: AuthDetails.reddit_password,
		scope: [ 'identity', 'read', 'vote' ]
}});

var twitch = new TwitchAPI({
	clientId: AuthDetails.twitch_clientid,
	clientSecret: AuthDetails.twitch_clientSecret,
	redirectUri: 'http://twitch.tv',
	scopes: ['user_follows_edit', 'chat_login', 'channel_feed_read', 'user_subscriptions']
});

function strLength(str) {
    var strSizes =[ '',
                    '',
                    "ijlI1,.;:'|!",
                    'frtJ-"~^*()',
                    'abcdeghknopqsuvxyzBEFLPRS2356789/?[{]}\\_`$ ',
                    'CKTXYZ04<>=+#&',//5
                    'wADGHNOQUV',
                    '@%',
                    'mMW—'
    ]
    var size=0;
    str = str.toString();
    for (var i = 0; i < str.length; i++) {
        for(var s=0;s<strSizes.length;s++) if (strSizes[s].indexOf(str[i])>-1) {
            size += s;
//            console.log(str[i] + " " + s);
        }
    }
    return size;
}

function padMatrix(matrix,header){
    var ratio=1.0/8.0;
    var padding=new Array(matrix.length-1);
    var max=0;
    for(var j=0;j<header.length;j++) {
        max = strLength(header[j]);
        for (var i = 0; i < matrix.length; i++) if (strLength(matrix[i][j]) > max) max = strLength(matrix[i][j]);
        if (j == 0)max -= 5;
        padding[j] = max + 8;
    }
    var output='';
    for(var i=0;i<header.length;i++){
        output+=header[i];
        if(i<header.length-1) {
            if(((padding[i]-strLength(header[i]))%8)>3)output+='-';
            for (var t = 0; t <= Math.floor((padding[i] - strLength(header[i])) * ratio); t++)output += '—';
        } else output+='\n';
    }
    for(var i=0;i<matrix.length;i++)for(var j=0;j<header.length;j++){
        output+=matrix[i][j];
        if(j<header.length-1){
            if(((padding[j]-strLength(matrix[i][j]))%8)>3)output+='-';
            for(var t=0;t<=Math.floor((padding[j]-strLength(matrix[i][j]))*ratio);t++)output+='—';
        } else output+='\n';
    }
    return output;
}


function createCommand(desc, process) {
	this.desc = desc;
	this.process = process;
}

/**/
commands.test = new createCommand(
    "testing command",
    function(message,arguments){
        var output='.\n.|.|.|.|.|.|.\n.'+arguments[1]+'.\n'+strLength(arguments[1]);

        bot.sendMessage(message,output);
    }
)

commands.help = new createCommand(
	"Help command. \n EX: " + identifier + "help <command> for help",
	function(message,arguments){
		if(arguments[1] in commands) bot.reply(message,commands[arguments[1]].desc);
}); 

commands.ping = new createCommand(
	"ping pong ~", 
	function(message, arguments) {
		bot.reply(message, "pong");
});

commands.roll = new createCommand(
	"Rolls dice. \n EX: " + identifier + "roll <number of dice> <number of sides>", 
	function(message, arguments) {
		var dice = arguments[1];
		var sides = arguments[2];
		var results = [];

		for(var i = 0; i < dice; i++) {
			results[i] = Math.ceil(Math.random()*sides);
		}
		
		var output = 'your rolls are: ';
		
		for(var i = 0; i < results.length; i++) {
			output += results[i] + ', ';
		}
		output = output.substring(0, output.length - 2);
		
		output += '. (rolled ' + dice + 'd' + sides + ')';
		bot.reply(message, output);
});

// FUTURE: create timers from chat?
commands.overwatch = new createCommand(
	"time until overwatch release \n EX: " + identifier + "overwatch",
	function(message, arguments){
		var output = "Overwatch will release in ";
		var dist = new Date("May 24, 2016");
		var now = new Date().getTime();
		dist = dist.getTime()-now;
		if(dist < 0){
			bot.reply(message,"Overwatch is released");
			return;
		}
		output += Math.floor(dist / (1000*60*60*24)) + " days, ";
		output += Math.floor((dist % (1000*60*60*24))/(1000*60*60)) + " hours, ";
		output += Math.floor((dist % (1000*60*60))/(1000*60)) + " minutes, and ";
		output += Math.floor((dist % (1000*60))/1000) + " seconds.";
		bot.reply(message, output);
});

commands.urban = new createCommand(
	"urban dictionary definition lookup \n EX: " + identifier + "urban .random OR " + identifier + "urban <word>",
	function(message, arguments){
	
	// random
	if(arguments[1] == '.random') {
		urban.random().first(function(json) {
			var word = json.word;
			var definition = json.definition;
			var rating_up = json.thumbs_up;
			var rating_down = json.thumbs_down;
			var output = word + " | +" + rating_up + " -" + rating_down + "\n" + definition;
			bot.sendMessage(message, output);
		});
	}
	else {
		// combine words
		var splicer = arguments.splice(1, 2);
		var searcher = splicer.join(' ');
		
		urban(searcher).first(function(json) {
			var word = json.word;
			var definition = json.definition;
			var rating_up = json.thumbs_up;
			var rating_down = json.thumbs_down;
			var output = word + " | +" + rating_up + " -" + rating_down + "\n" + definition;
			bot.sendMessage(message, output);			
		})
	}
	
});

commands.sr = new createCommand(
	"grabs a random post from a given subreddit \n EX: " + identifier + "sr <subreddit>",
	function(message, arguments){
		var subreddit = arguments[1];
		
		// switch between new/hot
		var newhot;
		if(Math.random() < 0.5) {
			newhot = 'new';
		} 
		else {
			newhot = 'hot';
		}
		var constructRequest = '/r/' + subreddit + '/' + newhot;
	  
		reddit(constructRequest).listing({limit: 100}).then(function(slice) {
		// choose a random post from the 100 pulled
		var randomPost = Math.floor(Math.random() * 100);
		var Submission = slice.children[randomPost];

		var output = Submission.data.title + ' -- ' + Submission.data.url;
		bot.sendMessage(message, output);

		});
	
});

commands.twitch = new createCommand(
	"twitcheronis \n EX: " + identifier + "twitch - displays current twitch stats \n EX: " + identifier + "twitch <username> - displays information about twitch user (if exists) \n EX: " + identifier + "twitch <top> <games/channels/streamers> - displays twitch top games/channels \n EX: " + identifier + "twitch <game> <gamename> - displays top streamers in game",
	function(message, arguments) {
		var output = "";

        if(arguments[1] == 'top' && arguments[2] == 'games') {
            twitch.getTopGames({}, function(err, body) {
                if (err) {
                    console.log(err);
					return;
                } else {
                    var matrix = new Array;
                    for(var i = 0; i < body.top.length; i++) {
                        matrix[i]=new Array(body.top[i].viewers, body.top[i].channels, body.top[i].game.name);
                    }
                    bot.sendMessage(message, padMatrix(matrix,["Viewers","Channels","Game"]));
                }
            });
        } else if(arguments[1] == 'top' && (arguments[2] == 'channels' || arguments[2] == 'streamers')) {
            // top streamers/channels
            twitch.getStreams({limit:25}, function(error, body) {
                if (error) {
                    console.log(error);
					return;
                } else {
                    var matrix = new Array;
                    for(var i = 0; i < body.streams.length; i++) {
                        matrix[i]=new Array(body.streams[i].channel.display_name, (body.streams[i].game==null?"(not listed)":body.streams[i].game), body.streams[i].viewers);
                    }
                    bot.sendMessage(message, padMatrix(matrix,["Streamer","Playing","Viewers"]));
                }
            });
        }
		else if(arguments[1] == 'game' && 2 in arguments) {
			// games filter
			var gamefilter;
			switch(arguments[2].toLowerCase()) {
				case 'ow':
				case 'overwatch':
					gamefilter = "Overwatch";
					break;
				case 'lol':
				case 'league':
				case 'league of legends':
					gamefilter = "League of Legends";
					break;
				case 'hearthstone':
					gamefilter = "Hearthstone: Heroes of Warcraft";
					break;
				case 'dota2':
				case 'd2':
				case 'dota 2':
					gamefilter = "Dota 2";
					break;
				case 'sc2':
				case 'sc':
				case 'starcraft':
					gamefilter = "StarCraft II";
					break;
				case 'hots':
				case 'heroes':
					gamefilter = "Heroes of the Storm";
					break;
				case 'csgo':
				case 'counter strike':
				case 'counterstrike':
				case 'go':
				case 'cs':
					gamefilter = "Counter-Strike: Global Offensive";
					break;
				case 'ffxiv':
				case 'ff14':
					gamefilter = "Final Fantasy XIV: Heavensward";
					break;
				default:
					gamefilter = arguments[1];
					break;
			}
			twitch.getStreams({limit:25, game: gamefilter}, function(error, body) {
				output += "Streamer ——————— Playing ——————— Viewer Count \n";
				if (error) {
					console.log(error);
					return;
				} else {
				for(var i = 0; i < body.streams.length; i++) {
				output += body.streams[i].channel.display_name + " ——————— " + body.streams[i].game + " ——————— " + body.streams[i].viewers + "\n";
				}
				bot.sendMessage(message, output);
				}

			});
		} else if(1 in arguments) {
			twitch.getChannelStream(arguments[1], function(error, body) {
				if (error) {
					console.log(error);
					return;
				} else {
                    if(body.stream == null) {
                        output += "Streamer is not online or does not exist.";
                    }
                    else {
                        output += body.stream.channel.display_name + " —— playing " + body.stream.channel.game + " —— "+ body.stream.channel.status + "\n Viewers: " + body.stream.viewers + " Views: " + body.stream.channel.views + " Followers: " + body.stream.channel.followers + "\n" + body.stream.channel.url;
                    }

					bot.sendMessage(message, output);
			}})
		} else {
			twitch.getStreamsSummary({}, function(error, body) {
                output += "Current Viewers on Twitch: " + body.viewers + ". Current Channels Live on Twitch: " + body.channels + ".";
				bot.sendMessage(message, output);
			})
		}
		
});

function generateCat(message) {
	var catoptions = {
		host: 'random.cat',
		port: 80,
		path: '/meow'
	};
	
	http.get(catoptions, function(res) {
		var body = '';
		
		res.on('data', function(data) {
			body += data;
		});
		
		res.on('end', function() {
			var response = JSON.parse(body);
			bot.sendMessage(message, response.file);
		});
		
		res.on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	
	});
}	


commands.cat = new createCommand(
	"cat bomb! \n EX: " + identifier + "cat <bomb>",
	function(message, arguments) {
		var num = 1;
		if(arguments[1] == 'bomb') {
			num = 5;
 			if(Number.isInteger(parseInt(arguments[2])) && parseInt(arguments[2]) != 0) num = parseInt(arguments[2]);
		}
		for (i = 0; i < num; i++) generateCat(message);
});

bot.on("message", function(message) {
    var content = message.content;
	
	// if message doesn't start with identifier, break
	if(content[0] != identifier) {
		return;
	}
	
	// remove first item (!command)
    content = content.substring(1);
	// shove arguments into array
	var arguments = content.split(" ");
	// call from command library
	commands[arguments[0]].process(message, arguments);
	
});

// log in to discord
bot.login(AuthDetails.email, AuthDetails.password);