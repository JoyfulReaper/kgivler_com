package main

import (
	"errors"
	"net"
	"net/http"
	"net/netip"
	"time"
)

func validateAdminListen(address string) error {
	if address == "" {
		return nil
	}
	endpoint, err := netip.ParseAddrPort(address)
	if err != nil || endpoint.Port() == 0 {
		return errors.New("DEV_ADMIN_LISTEN must be an explicit IP:port with a port from 1 to 65535")
	}
	ip := endpoint.Addr().Unmap()
	if endpoint.Addr().Zone() != "" || (!ip.IsLoopback() && !ip.IsPrivate()) {
		return errors.New("DEV_ADMIN_LISTEN must use a loopback or private IP without an interface zone")
	}
	return nil
}

// An unset address returns before creating a handler, server, or socket.
func prepareAdminServer(store *contactStore, address string) (*http.Server, net.Listener, error) {
	if err := validateAdminListen(address); err != nil {
		return nil, nil, err
	}
	if address == "" {
		return nil, nil, nil
	}
	handler, err := newAdminHandler(store)
	if err != nil {
		return nil, nil, errors.New("initialize private contact admin handler failed")
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		// Do not log the configured private address or underlying network error.
		return nil, nil, errors.New("bind DEV_ADMIN_LISTEN failed; check the configured interface and port")
	}
	server := &http.Server{
		Addr: address, Handler: handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	return server, listener, nil
}
