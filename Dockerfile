FROM node:12.18-alpine

ENV NODE_ENV ''

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
    numactl-dev \
    x264-dev \
    jansson-dev \
    libxml2-dev \
    libsamplerate-dev \
    libass-dev \
    libtheora-dev \
    lame-dev \
    opus-dev \
    libvorbis-dev \
    speex-dev \
    libvpx-dev \
    libva-dev \
    gtk+3.0-dev && \
  # Build HandBrake
  git clone https://github.com/HandBrake/HandBrake.git && \
  cd HandBrake && \
  git checkout refs/tags/$(git tag -l | grep -E '^1\.3\.[0-9]+$' | tail -n 1) && \
  ./configure --prefix=/usr \
    --disable-gtk \
    --disable-gtk-update-checks \
    --enable-fdk-aac \
    --enable-x265 \
    --enable-qsv \
    --launch-jobs=$(nproc) \
    --launch \
    && \
  make --directory=build install && \
  # Purge build deps
  apk del build-dependencies && \
  rm -rf /tmp/* /tmp/.[!.]*

# Move to the app dir
WORKDIR /usr/src/handbrake-server

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent

# Move source into container
COPY ./ ./

RUN \
  # Compile code to JS
  npm run build && \
  # Purge dev packages used for compiling
  npm prune --production --silent

EXPOSE 5100
CMD ["npm", "run", "server"]
