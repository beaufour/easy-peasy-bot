FROM debian:stretch-slim

ENV BOT_HOME=/var/lib/mopidy-slack-bot/

RUN set -ex \
# Requirements
        && apt-get update \
        && DEBIAN_FRONTEND=noninteractive apt-get install -y \
        curl \
        git \
        && curl -sL https://deb.nodesource.com/setup_12.x | bash - \
        && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs \
# Clean up
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* ~/.cache \
# Bot
        && git clone https://github.com/beaufour/mopidy-slack-bot $BOT_HOME \
        && cd $BOT_HOME \
        && npm install \
# User setup
        && useradd -d $BOT_HOME -s /usr/sbin/nologin mopidy-slack-bot \
        && chown mopidy-slack-bot -R $BOT_HOME

USER mopidy-slack-bot
WORKDIR $BOT_HOME
CMD ["/usr/bin/npm", "start"]
