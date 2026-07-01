package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type createEndpointReq struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type uptimeResponse struct {
	Stat    string `json:"stat"`
	Monitor struct {
		ID int `json:"id"`
	} `json:"monitor"`
	Monitors []struct {
		ID             int    `json:"id"`
		FriendlyName   string `json:"friendly_name"`
		URL            string `json:"url"`
		Type           int    `json:"type"`
		SubType        string `json:"sub_type"`
		KeywordType    int    `json:"keyword_type"`
		KeywordValue   string `json:"keyword_value"`
		HTTPUsername   string `json:"http_username"`
		HTTPPassword   string `json:"http_password"`
		Port           string `json:"port"`
		Interval       int    `json:"interval"`
		Status         int    `json:"status"`
		CreateDatetime int    `json:"create_datetime"`
	} `json:"monitors"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func monitoringCreateWebEndpoint(w http.ResponseWriter, r *http.Request) {
	if cfg.UptimeRobotKey == "" {
		http.Error(w, "UPTIMEROBOT_API_KEY not configured", http.StatusInternalServerError)
		return
	}

	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req createEndpointReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	companyID, err := db.CompanyByUserID(r.Context(), user.ID)
	if err != nil || companyID == nil {
		http.Error(w, "Company not found", http.StatusInternalServerError)
		return
	}

	// 1 = HTTP(s), 3 = Ping
	monitorType := "1"
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		// Default to ping if no schema
		monitorType = "3"
	}

	// Call UptimeRobot API
	apiURL := "https://api.uptimerobot.com/v2/newMonitor"
	data := url.Values{}
	data.Set("api_key", cfg.UptimeRobotKey)
	data.Set("format", "json")
	data.Set("type", monitorType)
	data.Set("url", req.URL)
	data.Set("friendly_name", req.Name)

	resp, err := http.PostForm(apiURL, data)
	if err != nil {
		http.Error(w, "Failed to call UptimeRobot", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var upResp uptimeResponse
	if err := json.Unmarshal(body, &upResp); err != nil {
		http.Error(w, "Failed to parse UptimeRobot response", http.StatusInternalServerError)
		return
	}

	if upResp.Stat != "ok" {
		errMsg := "Unknown error from UptimeRobot"
		if upResp.Error != nil {
			errMsg = upResp.Error.Message
		}
		http.Error(w, errMsg, http.StatusBadRequest)
		return
	}

	monitorID := fmt.Sprintf("%d", upResp.Monitor.ID)

	// Save to database
	_, err = db.Pool().Exec(r.Context(), `
		INSERT INTO public.monitored_endpoints (company_id, name, url_or_ip, uptimerobot_monitor_id, status, created_at)
		VALUES ($1, $2, $3, $4, 'pending', now())
	`, *companyID, req.Name, req.URL, monitorID)

	if err != nil {
		// Rollback on UptimeRobot? Ignored for simplicity
		http.Error(w, "Failed to save to database", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"monitor_id": monitorID,
	})
}

type MonitoredEndpoint struct {
	ID                   string     `json:"id"`
	CompanyID            string     `json:"company_id"`
	Name                 string     `json:"name"`
	URLOrIP              string     `json:"url_or_ip"`
	UptimeRobotMonitorID string     `json:"uptimerobot_monitor_id"`
	Status               string     `json:"status"` // e.g. "pending", "online", "offline", "paused"
	LastCheck            *time.Time `json:"last_check"`
	CreatedAt            time.Time  `json:"created_at"`
}

func monitoringListWebEndpoints(w http.ResponseWriter, r *http.Request) {
	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	companyID, err := db.CompanyByUserID(r.Context(), user.ID)
	if err != nil || companyID == nil {
		http.Error(w, "Company not found", http.StatusInternalServerError)
		return
	}

	// 1. Fetch from DB
	rows, err := db.Pool().Query(r.Context(), `
		SELECT id, name, url_or_ip, uptimerobot_monitor_id, status
		FROM public.monitored_endpoints
		WHERE company_id = $1
		ORDER BY created_at DESC
	`, *companyID)
	if err != nil {
		http.Error(w, "Failed to query endpoints", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var endpoints []map[string]interface{}
	monitorIDs := []string{}
	for rows.Next() {
		var id, name, urlOrIp, urID, status string
		if err := rows.Scan(&id, &name, &urlOrIp, &urID, &status); err != nil {
			continue
		}
		endpoints = append(endpoints, map[string]interface{}{
			"id":                     id,
			"name":                   name,
			"url_or_ip":              urlOrIp,
			"uptimerobot_monitor_id": urID,
			"status":                 status,
		})
		if urID != "" {
			monitorIDs = append(monitorIDs, urID)
		}
	}

	// 2. Fetch statuses from UptimeRobot if we have monitors and API key
	if len(monitorIDs) > 0 && cfg.UptimeRobotKey != "" {
		apiURL := "https://api.uptimerobot.com/v2/getMonitors"
		data := url.Values{}
		data.Set("api_key", cfg.UptimeRobotKey)
		data.Set("format", "json")
		data.Set("monitors", strings.Join(monitorIDs, "-"))

		resp, err := http.PostForm(apiURL, data)
		if err == nil {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			var upResp uptimeResponse
			if json.Unmarshal(body, &upResp) == nil && upResp.Stat == "ok" {
				// Create map of ID -> status
				statusMap := make(map[string]int)
				for _, m := range upResp.Monitors {
					statusMap[fmt.Sprintf("%d", m.ID)] = m.Status
				}

				// Update endpoints list
				for i, ep := range endpoints {
					urID := ep["uptimerobot_monitor_id"].(string)
					if s, ok := statusMap[urID]; ok {
						statusStr := "pending"
						switch s {
						case 0:
							statusStr = "paused"
						case 1:
							statusStr = "pending" // Not checked yet
						case 2:
							statusStr = "online" // Up
						case 8, 9:
							statusStr = "offline" // Down
						}
						
						// Only update DB if status changed
						if ep["status"] != statusStr {
							endpoints[i]["status"] = statusStr
							// Fire-and-forget update to DB
							go db.Pool().Exec(context.Background(), `
								UPDATE public.monitored_endpoints SET status = $1, last_check = now() WHERE uptimerobot_monitor_id = $2
							`, statusStr, urID)
						}
					}
				}
			}
		}
	}

	if endpoints == nil {
		endpoints = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(endpoints)
}

func monitoringDeleteWebEndpoint(w http.ResponseWriter, r *http.Request) {
	if cfg.UptimeRobotKey == "" {
		http.Error(w, "UPTIMEROBOT_API_KEY not configured", http.StatusInternalServerError)
		return
	}

	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	companyID, err := db.CompanyByUserID(r.Context(), user.ID)
	if err != nil || companyID == nil {
		http.Error(w, "Company not found", http.StatusInternalServerError)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "ID required", http.StatusBadRequest)
		return
	}

	// 1. Get UptimeRobot Monitor ID
	var urID string
	err = db.Pool().QueryRow(r.Context(), `
		SELECT uptimerobot_monitor_id FROM public.monitored_endpoints 
		WHERE id = $1 AND company_id = $2
	`, id, *companyID).Scan(&urID)

	if err != nil {
		http.Error(w, "Endpoint not found", http.StatusNotFound)
		return
	}

	// 2. Delete from UptimeRobot
	if urID != "" {
		apiURL := "https://api.uptimerobot.com/v2/deleteMonitor"
		data := url.Values{}
		data.Set("api_key", cfg.UptimeRobotKey)
		data.Set("format", "json")
		data.Set("id", urID)
		
		resp, err := http.PostForm(apiURL, data)
		if err == nil {
			resp.Body.Close()
		}
	}

	// 3. Delete from DB
	_, err = db.Pool().Exec(r.Context(), `
		DELETE FROM public.monitored_endpoints WHERE id = $1 AND company_id = $2
	`, id, *companyID)

	if err != nil {
		http.Error(w, "Failed to delete from DB", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
