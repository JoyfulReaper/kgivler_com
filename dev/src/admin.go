package main

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"html/template"
	"mime"
	"net/http"
	"strconv"
)

// These files are intentionally separate from the public staticFiles filesystem.
//
//go:embed admin/*
var adminFiles embed.FS

type adminHandler struct {
	store     *contactStore
	csrfToken string
	templates *template.Template
}

func newAdminHandler(store *contactStore) (http.Handler, error) {
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return nil, err
	}
	templates, err := template.ParseFS(adminFiles, "admin/*.html")
	if err != nil {
		return nil, err
	}
	h := &adminHandler{store: store, csrfToken: hex.EncodeToString(token[:]), templates: templates}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/contact", http.StatusSeeOther)
	})
	mux.HandleFunc("GET /admin/contact", h.list)
	mux.HandleFunc("GET /admin/contact/{id}", h.detail)
	mux.HandleFunc("POST /admin/contact/{id}/status", h.changeStatus)
	mux.HandleFunc("GET /admin/style.css", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, adminFiles, "admin/style.css")
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
		mux.ServeHTTP(w, r)
	}), nil
}

func (h *adminHandler) list(w http.ResponseWriter, r *http.Request) {
	contacts, err := h.store.listContacts(r.Context())
	if err != nil {
		http.Error(w, "Unable to load contact messages.", http.StatusInternalServerError)
		return
	}
	h.render(w, "list", contacts)
}

func (h *adminHandler) detail(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		http.NotFound(w, r)
		return
	}
	contact, err := h.store.getContact(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "Unable to load contact message.", http.StatusInternalServerError)
		return
	}
	h.render(w, "detail", struct {
		Contact storedContact
		Token   string
	}{contact, h.csrfToken})
}

func (h *adminHandler) changeStatus(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/x-www-form-urlencoded" {
		http.Error(w, "Use the status form to make this change.", http.StatusUnsupportedMediaType)
		return
	}
	if err := r.ParseForm(); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			http.Error(w, "Status form is too large.", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "Unable to read status form.", http.StatusBadRequest)
		}
		return
	}
	// Read only the POST body, so tokens in URLs never authorize changes.
	if subtle.ConstantTimeCompare([]byte(r.PostForm.Get("csrf_token")), []byte(h.csrfToken)) != 1 {
		http.Error(w, "Invalid form token. Reload the message and try again.", http.StatusForbidden)
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		http.NotFound(w, r)
		return
	}
	err = h.store.updateContactStatus(r.Context(), id, r.PostForm.Get("status"))
	if errors.Is(err, errInvalidContactStatus) {
		http.Error(w, "Choose new, read, archived, or spam.", http.StatusBadRequest)
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "Unable to update contact status.", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/admin/contact/"+strconv.FormatInt(id, 10), http.StatusSeeOther)
}

func (h *adminHandler) render(w http.ResponseWriter, name string, data any) {
	var body bytes.Buffer
	if err := h.templates.ExecuteTemplate(&body, name, data); err != nil {
		http.Error(w, "Unable to display contact messages.", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(body.Bytes())
}
