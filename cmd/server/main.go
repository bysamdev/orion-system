package main

import (
	"log"
	"net/http"

	"orion-api/handler"
)

func main() {
	log.Println("Orion API local server listening on :3000...")
	if err := http.ListenAndServe(":3000", http.HandlerFunc(handler.Handler)); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
