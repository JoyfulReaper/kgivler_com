package main

import (
	"net"
	"strings"
	"testing"
)

func TestAdminListenValidation(t *testing.T) {
	for _, address := range []string{
		"", "127.0.0.1:5197", "[::1]:5197", "10.0.0.1:5197",
		"172.16.0.1:5197", "172.31.255.254:5197", "192.168.0.1:65535",
		"[fd00::1]:5197", "[fc00::1]:1", "[::ffff:127.0.0.1]:5197",
	} {
		t.Run("accept/"+address, func(t *testing.T) {
			if err := validateAdminListen(address); err != nil {
				t.Fatal(err)
			}
		})
	}
	for _, address := range []string{
		"0.0.0.0:5197", "[::]:5197", ":5197", "[::ffff:0.0.0.0]:5197",
		"8.8.8.8:5197", "[2001:4860:4860::8888]:5197", "[::ffff:8.8.8.8]:5197",
		"172.15.0.1:5197", "172.32.0.1:5197", "169.254.1.1:5197", "[fe80::1]:5197",
		"224.0.0.1:5197", "[ff02::1]:5197", "100.64.0.1:5197",
		"localhost:5197", "127.0.0.1", "::1:5197", "127.0.0.1:0",
		"127.0.0.1:65536", "127.0.0.1:-1", "127.0.0.1:http", "garbage", " ",
		" 127.0.0.1:5197", "[fd00::1%test]:5197", "[::ffff:127.0.0.1%test]:5197",
	} {
		t.Run("reject/"+address, func(t *testing.T) {
			if err := validateAdminListen(address); err == nil {
				t.Fatal("unsafe or invalid listen address accepted")
			}
		})
	}
}

func TestAdminDisabledWithoutListener(t *testing.T) {
	server, listener, err := prepareAdminServer(nil, "")
	if err != nil || server != nil || listener != nil {
		t.Fatalf("unset admin created resources: server=%v, listener=%v, err=%v", server, listener, err)
	}
}

func TestAdminInvalidAddressDoesNotCreateListener(t *testing.T) {
	server, listener, err := prepareAdminServer(nil, ":5197")
	if err == nil || server != nil || listener != nil {
		t.Fatal("invalid admin configuration did not fail closed")
	}
}

func TestAdminBindFailureDoesNotFallback(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()
	store, _ := newTestContactStore(t)
	server, listener, err := prepareAdminServer(store, occupied.Addr().String())
	if err == nil || server != nil || listener != nil {
		t.Fatal("occupied admin address did not fail closed")
	}
	if strings.Contains(err.Error(), occupied.Addr().String()) {
		t.Fatal("bind failure exposed private listener address")
	}
}
