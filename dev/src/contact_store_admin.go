package main

import (
	"context"
	"database/sql"
	"errors"
)

type contactSummary struct {
	ID         int64
	CreatedUtc string
	Name       string
	Email      string
	Phone      string
	Subject    string
	Status     string
}

type storedContact struct {
	contactSummary
	Message string
}

var errInvalidContactStatus = errors.New("invalid contact status")

func (s *contactStore) listContacts(ctx context.Context) ([]contactSummary, error) {
	// IDs reflect insertion order without depending on clock changes or timestamp precision.
	rows, err := s.db.QueryContext(ctx, `SELECT Id, CreatedUtc, Name, Email, Phone, Subject, Status
		FROM ContactMessages ORDER BY Id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var contacts []contactSummary
	for rows.Next() {
		var contact contactSummary
		if err := rows.Scan(&contact.ID, &contact.CreatedUtc, &contact.Name, &contact.Email,
			&contact.Phone, &contact.Subject, &contact.Status); err != nil {
			return nil, err
		}
		contacts = append(contacts, contact)
	}
	return contacts, rows.Err()
}

func (s *contactStore) getContact(ctx context.Context, id int64) (storedContact, error) {
	var contact storedContact
	err := s.db.QueryRowContext(ctx, `SELECT Id, CreatedUtc, Name, Email, Phone, Subject, Status, Message
		FROM ContactMessages WHERE Id = ?`, id).Scan(&contact.ID, &contact.CreatedUtc, &contact.Name,
		&contact.Email, &contact.Phone, &contact.Subject, &contact.Status, &contact.Message)
	return contact, err
}

func (s *contactStore) updateContactStatus(ctx context.Context, id int64, status string) error {
	switch status {
	case "new", "read", "archived", "spam":
	default:
		return errInvalidContactStatus
	}
	result, err := s.db.ExecContext(ctx, "UPDATE ContactMessages SET Status = ? WHERE Id = ?", status, id)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}
