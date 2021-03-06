FROM ubuntu:18.04

LABEL maintainer="Atomist <docker@atomist.com>"

RUN apt-get update && apt-get install -y \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV DUMB_INIT_VERSION=1.2.2

RUN curl -s -L -O https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && dpkg -i dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && rm -f dumb-init_${DUMB_INIT_VERSION}_amd64.deb

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 2866

ENV BLUEBIRD_WARNINGS 0
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL warn
ENV SUPPRESS_NO_CONFIG_WARNING true
ENV NODE_OPTIONS --no-deprecation

ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=384"]

CMD ["/opt/app/node_modules/.bin/atm-start"]

RUN apt-get update && apt-get install -y \
        build-essential \
        docker.io \
        git \
        unzip \
        openjdk-8-jdk \
    && rm -rf /var/lib/apt/lists/*

RUN git config --global user.email "bot@atomist.com" \
    && git config --global user.name "Atomist Bot"

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.10.8/bin/linux/amd64/kubectl \
    && chmod +x /usr/local/bin/kubectl

ENV LEIN_ROOT true
RUN curl -sL -o /usr/local/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
    && chmod +x /usr/local/bin/lein

COPY package.json package-lock.json ./

RUN NODE_ENV=development npm ci \
    && npm cache clean --force

COPY . .
