FROM ubuntu:latest

RUN apt-get update && apt-get install -y \
    golang-go \
    nginx \
    ca-certificates \
    && apt-get clean

COPY client /app/client
COPY server /app/server
COPY go.mod go.mod
COPY go.sum go.sum

RUN go build /app/server

RUN rm /etc/nginx/sites-enabled/default
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY start_host.sh /start_host.sh
RUN chmod +x /start_host.sh

EXPOSE 5500
EXPOSE 5501

CMD ["/start_host.sh"]