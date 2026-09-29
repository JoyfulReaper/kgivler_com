package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultMissionControlURL = "http://127.0.0.1:5190/api/events"
	missionControlEventType  = "devsite.visit"
)

type missionControlEvent struct {
	EventID       string      `json:"eventId"`
	EventType     string      `json:"eventType"`
	SchemaVersion int         `json:"schemaVersion"`
	OccurredAt    time.Time   `json:"occurredAt"`
	CorrelationID *string     `json:"correlationId"`
	Payload       interface{} `json:"payload"`
}

type missionControlVisitPayload struct {
	Remote    string `json:"remote"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	UserAgent string `json:"userAgent"`
	Referrer  string `json:"referrer,omitempty"`
}

var missionControlHTTPClient = &http.Client{
	Timeout: time.Second,
}

func publishMissionControlVisit(r *http.Request) {
	apiKey := strings.TrimSpace(os.Getenv("MISSION_CONTROL_API_KEY"))
	if apiKey == "" {
		return
	}

	eventID, err := newMissionControlEventID()
	if err != nil {
		log.Printf("Mission Control event ID generation failed: %v", err)
		return
	}

	event := missionControlEvent{
		EventID:       eventID,
		EventType:     missionControlEventType,
		SchemaVersion: 1,
		OccurredAt:    time.Now().UTC(),
		Payload: missionControlVisitPayload{
			Remote:    requestRemoteHost(r),
			Method:    r.Method,
			Path:      r.URL.Path,
			UserAgent: r.UserAgent(),
			Referrer:  r.Referer(),
		},
	}

	body, err := json.Marshal(event)
	if err != nil {
		log.Printf("Mission Control telemetry marshal failed: %v", err)
		return
	}

	missionURL := getenv("MISSION_CONTROL_URL", defaultMissionControlURL)

	req, err := http.NewRequest(http.MethodPost, missionURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("Mission Control telemetry request failed: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Mission-Control-Key", apiKey)

	resp, err := missionControlHTTPClient.Do(req)
	if err != nil {
		log.Printf("Mission Control telemetry publish failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("Mission Control telemetry rejected: HTTP %d", resp.StatusCode)
	}
}

func requestRemoteHost(r *http.Request) string {
	immediate := remoteHost(r.RemoteAddr)

	peerIP := net.ParseIP(immediate)
	if peerIP == nil || !peerIP.IsLoopback() {
		return immediate
	}

	// Cloudflare Tunnel supplies the original visitor address here.
	if value := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); value != "" {
		if parsed := net.ParseIP(value); parsed != nil {
			return parsed.String()
		}
	}

	// Useful if we ever put nginx in front later.
	if value := strings.TrimSpace(r.Header.Get("X-Real-IP")); value != "" {
		if parsed := net.ParseIP(value); parsed != nil {
			return parsed.String()
		}
	}

	return immediate
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return host
	}

	return remoteAddr
}

func newMissionControlEventID() (string, error) {
	var b [16]byte

	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	s := hex.EncodeToString(b[:])

	return s[0:8] + "-" +
		s[8:12] + "-" +
		s[12:16] + "-" +
		s[16:20] + "-" +
		s[20:32], nil
}
