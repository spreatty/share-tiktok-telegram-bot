FROM node:lts-alpine

LABEL fly_launch_runtime="nodejs"

RUN mkdir /app
WORKDIR /app
COPY . .
RUN npm ci

CMD ["npm", "start"]
