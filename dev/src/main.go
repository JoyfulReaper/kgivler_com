package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"time"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	addr := getenv("DEV_SITE_LISTEN", "127.0.0.1:5196")

	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	mux.Handle("GET /", http.FileServer(http.FS(staticFS)))

	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok\n"))
	})

	server := &http.Server{
		Addr:              addr,
		Handler:           requestLogging(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen %s: %v", addr, err)
	}

	log.Printf("dev.kgivler.com listening on http://%s", addr)

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func requestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		var telemetryRequest *http.Request

		if r.Method == http.MethodGet && r.URL.Path == "/" {
			telemetryRequest = r.Clone(context.Background())
		}

		next.ServeHTTP(w, r)

		if telemetryRequest != nil {
			go publishMissionControlVisit(telemetryRequest)
		}

		log.Printf(
			"%s %s remote=%s duration=%s",
			r.Method,
			r.URL.Path,
			requestRemoteHost(r),
			time.Since(start).Round(time.Millisecond),
		)
	})
}

func getenv(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}
