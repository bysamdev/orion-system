//go:build windows

package service

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"
)

// ShowUpdateNotification exibe uma notificacao nativa do Windows no canto da tela.
func ShowUpdateNotification(title, message string) {
	go func() {
		cleanTitle := strings.ReplaceAll(title, "'", "''")
		cleanTitle = strings.ReplaceAll(cleanTitle, "<", "&lt;")
		cleanTitle = strings.ReplaceAll(cleanTitle, ">", "&gt;")

		cleanMsg := strings.ReplaceAll(message, "'", "''")
		cleanMsg = strings.ReplaceAll(cleanMsg, "<", "&lt;")
		cleanMsg = strings.ReplaceAll(cleanMsg, ">", "&gt;")

		psScript := fmt.Sprintf(`
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast duration="short"><visual><binding template="ToastGeneric"><text>%s</text><text>%s</text></binding></visual></toast>')
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe')
$notifier.Show($toast)
`, cleanTitle, cleanMsg)

		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = cmd.Run()
	}()
}