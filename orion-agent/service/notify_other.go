//go:build !windows

package service

// ShowUpdateNotification no-op para outros sistemas operacionais.
func ShowUpdateNotification(title, message string) {
}
