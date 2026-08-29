package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestMergeUsers_ExigeAuth cobre o caminho sem token — mergeUsers precisa
// recusar antes de qualquer trabalho, igual deleteUserAdmin/adminUpdateUser.
func TestMergeUsers_ExigeAuth(t *testing.T) {
	body, _ := json.Marshal(mergeUsersReq{SourceUserID: "a", TargetUserID: "b"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/functions/merge-users", bytes.NewReader(body))

	mergeUsers(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401 (sem token)", rec.Code)
	}
}
