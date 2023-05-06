FROM node:18-alpine

# Stay in temp dir until build is complete
WORKDIR /tmp

RUN \
  # Install HB build deps
  apk add --virtual build-dependencies \
    build-base \
    yasm \
    autoconf \
    cmake \
    automake \
    libtool \
    m4 \
    patch \
    coreutils \
    tar \
    file \
    linux-headers \
    intltool \
    git \
    diffutils \
    bash \
    nasm \
    meson \
    libsamplerate-dev \
    libxml2-dev \
    gtk+3.0-dev && \
  apk add \
    numactl-dev \
    x264-dev \
    jansson-dev \
    libass-dev \
    libjpeg-turbo \
    libtheora-dev \
    lame-dev \
    opus-dev \
    libvorbis-dev \
    speex-dev \
    libvpx-dev \
    libva-dev
RUN \
  # Build HandBrake
  git clone https://github.com/HandBrake/HandBrake.git && \
  cd HandBrake && \
  git checkout refs/tags/$(git tag -l | grep -E '^1\.6\.[0-9]+$' | tail -n 1) && \
  ./configure --prefix=/usr \
    --disable-gtk \
    --disable-gtk-update-checks \
    --enable-fdk-aac \
    --enable-x265 \
    --enable-numa \
    --enable-nvenc \
    --enable-qsv \
    --enable-vce \
    --launch-jobs=$(nproc) \
    --launch \
    && \
  make --directory=build install && \
  # Purge build deps
  apk del build-dependencies && \
  rm -rf /tmp/* /tmp/.[!.]*

# Move to the app dir
WORKDIR /usr/src/handbrake-server

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "tsconfig.json", "./"]
RUN npm install --silent

# Move configs into container
COPY ["./config/default.js", "./config/custom-environment-variables.js", "./config/"]

# Move source into container
COPY ["./src/", "./src/"]

RUN \
  # Compile code to JS
  npm run build && \
  # Purge dev packages used for compiling
  npm prune --production --silent && \
  # Delete source after compile
  rm -r ./src

ENV NODE_ENV="" \
  HB_JOB_DIR="/jobs"

VOLUME ["/jobs"]

EXPOSE 5100
CMD ["npm", "run", "server"]
