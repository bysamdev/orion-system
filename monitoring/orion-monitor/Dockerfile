# Orion Monitor — construído a partir da raiz do repositório (o serviço vive
# no mesmo módulo Go da API: pacote monitor, comando cmd/orion-monitor).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /orion-monitor ./cmd/orion-monitor

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget && adduser -D -H monitor
USER monitor
COPY --from=build /orion-monitor /usr/local/bin/orion-monitor
EXPOSE 9300
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://localhost:9300/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/orion-monitor"]
