package api

import (
	"net/http"

	"orion-api/handler"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	handler.Handler(w, r)
}
