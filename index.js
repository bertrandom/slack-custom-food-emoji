var fs = require('fs');

var request = require('request');
var chrome = require('chrome-cookies-secure');
var cheerio = require('cheerio');
var _ = require('lodash');
var ProgressBar = require('progress');
var chalk = require('chalk');
var argv = require('yargs')
                .usage('Usage: $0 [teamdomain]')
                .demand(1)
                .argv;

if (!fs.existsSync('./glitch-assets-parser/items.json')) {
    console.error(chalk.red('Glitch assets not found!') + ' Try running this:');
    console.log('git clone git@github.com:bertrandom/glitch-assets-parser.git');
    return;
}

var items = require('./glitch-assets-parser/items.json');

var teamdomain = argv._[0];

var domain = teamdomain + '.slack.com';

console.log('Talking to ' + chalk.blue(domain) + '...');

chrome.getCookies('https://' + domain + '/', 'jar', function(err, jar) {
    request({url: 'https://' + domain + '/customize/emoji', jar: jar, followRedirect: false}, function (err, response, body) {

        if (response.statusCode === 302) {

            console.log('Not authorized. Please sign in to ' + chalk.blue('https://' + domain + '/') + ' in Google Chrome, wait a few seconds and try again.');
            return;

        }

    	var existingEmoji = {};

    	$ = cheerio.load(body);
    	$('#emojialias option').each(function(index, node) {
    		var value = $(node).attr('value');
    		existingEmoji[value] = true;
    	});

        var queueItems = [];

        for (var name in items.drinks) {

            if (existingEmoji[name]) {
                continue;
            }

            var drink = items.drinks[name];
            var path = __dirname + '/glitch-assets-parser/' + drink.asset_path;
            queueItems.push([name, path]);

        }

        for (var name in items.food) {

            if (existingEmoji[name]) {
                continue;
            }

            var food = items.food[name];
            var path = __dirname + '/glitch-assets-parser/' + food.asset_path;
            queueItems.push([name, path]);

        }

        queueItems = _.sortBy(queueItems, function(item) { return item[0]; });

        if (queueItems.length === 0) {
            console.log('All emoji already exist!');
            return;
        }

        console.log('Adding ' + queueItems.length + ' emoji...');
        var bar = new ProgressBar(':bar', { total: queueItems.length });

        var drainQueue = function() {

            var queueItem = queueItems.shift();

            if (queueItems.length > 0) {
                drainQueue();
            }

            request({url: 'https://' + domain + '/customize/emoji', jar: jar}, function (err, response, body) {

                var postFields = {};

                $ = cheerio.load(body);
                $('#addemoji input').each(function(index, node) {

                    var type = $(node).attr('type');

                    if (type === 'hidden' || type === 'checkbox') {
                        postFields[$(node).attr('name')] = $(node).attr('value');
                    }

                });

                postFields.name = queueItem[0];
                postFields.mode = 'data';
                postFields.img = fs.createReadStream(queueItem[1]);

                request.post({
                    url: 'https://' + domain + '/customize/emoji', 
                    jar: jar,
                    formData: postFields
                }, function(err, response, body) {

                    bar.tick();

                });

            });

        };

        drainQueue();

    });
});