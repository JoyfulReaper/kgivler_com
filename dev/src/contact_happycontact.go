package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const happyContactTimeout = 3 * time.Second

type happyContactClient struct {
	endpoint             string
	client               *http.Client
	trustCloudflareProxy bool
}

var happyContactSiteID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// An unset backend deliberately retains SQLite. Invalid opt-in configuration
// stops startup rather than silently changing where submissions are stored.
func happyContactFromEnv() (*happyContactClient, error) {
	switch os.Getenv("DEV_CONTACT_BACKEND") {
	case "", "sqlite":
		return nil, nil
	case "happycontact":
	default:
		return nil, errors.New("DEV_CONTACT_BACKEND must be sqlite or happycontact")
	}

	base, err := url.Parse(os.Getenv("DEV_HAPPYCONTACT_BASE_URL"))
	if err != nil || base == nil {
		return nil, errors.New("DEV_HAPPYCONTACT_BASE_URL must be a loopback HTTP(S) origin")
	}
	ip := net.ParseIP(base.Hostname())
	if (base.Scheme != "http" && base.Scheme != "https") || ip == nil || !ip.IsLoopback() ||
		base.User != nil || (base.Path != "" && base.Path != "/") || base.RawPath != "" ||
		base.RawQuery != "" || base.ForceQuery || base.Fragment != "" || base.Opaque != "" {
		return nil, errors.New("DEV_HAPPYCONTACT_BASE_URL must be a loopback HTTP(S) origin without credentials, path, query, or fragment")
	}
	if port := base.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return nil, errors.New("DEV_HAPPYCONTACT_BASE_URL has an invalid port")
		}
	}
	siteID := os.Getenv("DEV_HAPPYCONTACT_SITE_ID")
	if !happyContactSiteID.MatchString(siteID) || siteID == "00000000-0000-0000-0000-000000000000" {
		return nil, errors.New("DEV_HAPPYCONTACT_SITE_ID must be a nonzero site GUID")
	}
	trustProxy := false
	if value := os.Getenv("DEV_CONTACT_TRUST_CLOUDFLARE_PROXY"); value != "" {
		trustProxy, err = strconv.ParseBool(value)
		if err != nil {
			return nil, errors.New("DEV_CONTACT_TRUST_CLOUDFLARE_PROXY must be a boolean")
		}
	}

	base.Path = "/api/v1/sites/" + siteID + "/submissions"
	transport := http.DefaultTransport.(*http.Transport).Clone()
	// Keep the local message and visitor IP out of environment-configured proxies.
	transport.Proxy = nil
	return &happyContactClient{
		endpoint: base.String(), trustCloudflareProxy: trustProxy,
		client: &http.Client{
			Timeout: happyContactTimeout, Transport: transport,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}, nil
}

// Never reuse requestRemoteHost's X-Real-IP fallback for this trust boundary.
// Opting in requires a loopback-only ingress where cloudflared overwrites CF's
// header. Direct non-loopback callers can never assert a forwarded visitor IP.
func (c *happyContactClient) visitorIP(r *http.Request) string {
	peer := net.ParseIP(remoteHost(r.RemoteAddr))
	if peer == nil {
		return ""
	}
	if c.trustCloudflareProxy && peer.IsLoopback() {
		values := r.Header.Values("CF-Connecting-IP")
		if len(values) == 1 {
			if visitor := net.ParseIP(strings.TrimSpace(values[0])); visitor != nil {
				return visitor.String()
			}
		}
	}
	return peer.String()
}

// submit makes one attempt. Only 202 means stored; response bodies and raw
// transport errors are intentionally ignored because they may contain secrets.
// The returned status is for the existing generic HTML error page (zero on 202).
func (c *happyContactClient) submit(ctx context.Context, message contactMessage, visitorIP string) int {
	body, err := json.Marshal(struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone,omitempty"`
		Subject string `json:"subject,omitempty"`
		Message string `json:"message"`
	}{message.Name, message.Email, message.Phone, message.Subject, message.Message})
	if err != nil {
		log.Print("HappyContact submission failed: encode request")
		return http.StatusBadGateway
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		log.Print("HappyContact submission failed: create request")
		return http.StatusBadGateway
	}
	req.Header.Set("Content-Type", "application/json")
	if ip := net.ParseIP(visitorIP); ip != nil {
		req.Header.Set("CF-Connecting-IP", ip.String())
	}
	resp, err := c.client.Do(req)
	if err != nil {
		log.Print("HappyContact submission failed: request failed")
		var timeout net.Error
		if errors.As(err, &timeout) && timeout.Timeout() {
			return http.StatusGatewayTimeout
		}
		return http.StatusServiceUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusAccepted {
		return 0
	}
	log.Printf("HappyContact submission failed: HTTP %d", resp.StatusCode)
	switch resp.StatusCode {
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return http.StatusBadRequest
	case http.StatusTooManyRequests:
		return http.StatusTooManyRequests
	case http.StatusServiceUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusBadGateway
	}
}
