/**
 * A Mopidy Bot for Slack
 */

const CHANNEL = 'CGNU86GG7';

const Mopidy = require("mopidy");

/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */
function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */
var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */
if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENT_ID, CLIENT_SECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Mopidy setup
 */
const mopidy = new Mopidy();

// These are just for debugging, as they log every event from Mopidy
mopidy.on('state', console.log);
mopidy.on('event', console.log);

mopidy.on('state:online', function () {
    console.log('Connected to Mopidy');
});

/**
 * Bot logic
 */
var getTrackName = function(track) {
    var artist = 'Unknown Artist';
    if (track.artists && track.artists.length) {
        artist = track.artists[0].name;
    };
    return artist + ' - ' + track.name;
};

mopidy.on('event:trackPlaybackStarted', function (event) {
    var track = event.tl_track.track;
    var msg = 'Playing: ' + getTrackName(track);
    console.log(msg);

    controller.getBot().say(
        {
            text: msg,
            channel: CHANNEL
        }
    );
});

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here to save the day!");
});

controller.hears('hello', 'direct_message', function (bot, message) {
    bot.reply(message, 'Hello!');
});

controller.hears(['current', 'current song'], ['direct_message', 'direct_mention'], function (bot, message) {
    // TODO: ugly, to not use the bot here... but something about the two async functions is not
    // working for me
    var channel = message.channel;

    const trackHandler = track => {
        var msg = 'Nothing';
        if (track) {
            msg = getTrackName(track);
        }
        console.log('Current track: ', msg);
        msg = 'Currently playing: ' + msg;
        controller.getBot().say(
            {
                text: msg,
                channel: channel
            });
        return;
    };

    const failureHandler = () => {
        console.warn('Could not get current track: ');
        controller.getBot().say(
            {
                text: 'Could not get current track :(',
                channel: channel
            });
    };
    mopidy.playback.getCurrentTrack().then(trackHandler, failureHandler);
});

controller.hears(['queue', 'show queue'], ['direct_message', 'direct_mention'], function (bot, message) {
    // TODO: ugly, to not use the bot here... but something about the two async functions is not
    // working for me
    var channel = message.channel;

    const tracksHandler = tracks => {
        if (!tracks || !tracks.length) {
            controller.getBot().say(
                {
                    text: 'Queue is empty',
                    channel: channel
                });
            return;
        }
        console.log(tracks);

        const indexHandler = index => {
            console.log("Got index: ", index);
            tracks = tracks.slice(index + 1, index + 6);
            var msg = '';
            for (var i = 0; i < tracks.length; ++i) {
                msg = msg + (i + 1) + '. ' + getTrackName(tracks[i]) + '\n';
            }
            controller.getBot().say(
                {
                    text: 'Here is the queue:\n' + msg,
                    channel: channel
                });
        };

        mopidy.tracklist.index().then(indexHandler, failureHandler);
    };
    const failureHandler = () => {
        console.warn('Could not get queue: ');
        controller.getBot().say(
            {
                text: 'Could not get queue :(',
                channel: channel
            });
    };
    mopidy.tracklist.getTracks().then(tracksHandler, failureHandler);
});


controller.hears(['skip', 'next'], ['direct_message', 'direct_mention'], function (bot, message) {
    console.log('Skipping song');
    bot.reply(message, 'Skipping current song');
    mopidy.playback.next();
});
