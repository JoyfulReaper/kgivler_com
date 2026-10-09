package main

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type contactMessage struct {
	Name    string
	Email   string
	Phone   string
	Subject string
	Message string
}

type contactStore struct {
	db *sql.DB
}

func openContactStore(path string) (*contactStore, error) {
	path, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	// Restrict newly created files on Unix; deployment owns existing permissions.
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err := file.Close(); err != nil {
		return nil, err
	}

	dsn := url.URL{Scheme: "file", Path: "/" + strings.TrimPrefix(filepath.ToSlash(path), "/")}
	params := url.Values{"_pragma": {"busy_timeout(5000)"}}
	dsn.RawQuery = params.Encode()
	db, err := sql.Open("sqlite", dsn.String())
	if err != nil {
		return nil, err
	}
	// A contact form needs only one connection; serialize local SQLite writes.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS ContactMessages (
		Id INTEGER PRIMARY KEY AUTOINCREMENT,
		CreatedUtc TEXT NOT NULL,
		Name TEXT NOT NULL,
		Email TEXT NOT NULL,
		Phone TEXT NOT NULL DEFAULT '',
		Subject TEXT NOT NULL DEFAULT '',
		Message TEXT NOT NULL,
		Status TEXT NOT NULL DEFAULT 'new'
	)`); err != nil {
		db.Close()
		return nil, err
	}
	return &contactStore{db: db}, nil
}

func (s *contactStore) save(ctx context.Context, message contactMessage) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO ContactMessages
		(CreatedUtc, Name, Email, Phone, Subject, Message) VALUES (?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339Nano), message.Name, message.Email,
		message.Phone, message.Subject, message.Message)
	return err
}
