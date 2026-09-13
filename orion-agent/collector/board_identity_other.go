//go:build !windows

package collector

// identidadeDeHardware não tem fonte fora do Windows (SMBIOS e adaptadores vêm
// do WMI); sem os valores, o backend simplesmente não tenta mesclar.
func identidadeDeHardware() (uuid, mac string) {
	return "", ""
}
