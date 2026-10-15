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
	store, err := openContactStore(getenv("DEV_CONTACT_DB_PATH", "data/contact.db"))
	if err != nil {
		log.Fatalf("initialize contact storage: %v", err)
	}
	defer store.db.Close()

	notifier := newContactNotifier(os.Getenv("DEV_CONTACT_NTFY_URL"), os.Getenv("DEV_CONTACT_NTFY_TOKEN"))
	mux, err := newSiteHandler(store, notifier)
	if err != nil {
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:              addr,
		Handler:           requestLogging(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	adminServer, adminListener, err := prepareAdminServer(store, os.Getenv("DEV_ADMIN_LISTEN"))
	if err != nil {
		log.Fatal(err)
	}
	if adminListener != nil {
		defer adminListener.Close()
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen %s: %v", addr, err)
	}

	if adminServer != nil {
		go func() {
			if err := adminServer.Serve(adminListener); err != nil && err != http.ErrServerClosed {
				log.Fatal("private contact admin server failed")
			}
		}()
		log.Print("private contact admin listener started")
	}

	log.Printf("dev.kgivler.com listening on http://%s", addr)

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func newSiteHandler(store *contactStore, notifier *contactNotifier) (http.Handler, error) {
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()

	mux.Handle("GET /", http.FileServer(http.FS(staticFS)))
	contact := &contactHandler{store: store, limiter: newContactLimiter(time.Now), notifier: notifier}
	mux.HandleFunc("POST /contact", contact.handleContact)

	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok\n"))
	})

	return mux, nil
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
