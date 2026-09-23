// Nome e ícone do sistema operacional a partir do texto que o agente envia.
export function parseOsInfo(os?: string | null, osVersion?: string | null): {
  name: string;
  shortLabel: string;
  type: 'win11' | 'win10' | 'winserver' | 'windows' | 'linux' | 'mac' | 'other';
} {
  const normOs = (os || '').toLowerCase();
  const normVer = (osVersion || '').toLowerCase();

  // Windows Server Check
  if (
    normVer.includes('server') ||
    normOs.includes('server') ||
    normVer.includes('2016') ||
    normVer.includes('2019') ||
    normVer.includes('2022') ||
    normVer.includes('2025')
  ) {
    let year = '';
    if (normVer.includes('2025')) year = ' 2025';
    else if (normVer.includes('2022')) year = ' 2022';
    else if (normVer.includes('2019')) year = ' 2019';
    else if (normVer.includes('2016')) year = ' 2016';
    else if (normVer.includes('2012')) year = ' 2012';
    return { name: `Windows Server${year}`, shortLabel: `Server${year}`, type: 'winserver' };
  }

  // Windows 11 vs Windows 10 vs other Windows
  if (normOs.includes('win') || normVer.includes('windows')) {
    const match = normVer.match(/build\s*(\d+)/i) || normVer.match(/10\.0\.(\d+)/i);
    let buildNum = 0;
    if (match && match[1]) {
      buildNum = parseInt(match[1], 10);
    }

    const isWin11 =
      normVer.includes('11') ||
      normOs.includes('11') ||
      buildNum >= 22000;

    if (isWin11) {
      return { name: 'Windows 11', shortLabel: 'Win 11', type: 'win11' };
    }

    if (normVer.includes('10') || normOs.includes('10') || (buildNum >= 10240 && buildNum < 22000)) {
      return { name: 'Windows 10', shortLabel: 'Win 10', type: 'win10' };
    }

    if (normVer.includes('8.1')) {
      return { name: 'Windows 8.1', shortLabel: 'Win 8.1', type: 'windows' };
    }
    if (normVer.includes('7')) {
      return { name: 'Windows 7', shortLabel: 'Win 7', type: 'windows' };
    }

    return { name: 'Windows', shortLabel: 'Windows', type: 'windows' };
  }

  // Linux
  if (
    normOs.includes('linux') ||
    normVer.includes('ubuntu') ||
    normVer.includes('debian') ||
    normVer.includes('centos') ||
    normVer.includes('redhat') ||
    normVer.includes('rhel') ||
    normVer.includes('arch') ||
    normVer.includes('fedora') ||
    normVer.includes('alpine')
  ) {
    let distro = 'Linux';
    if (normVer.includes('ubuntu') || normOs.includes('ubuntu')) distro = 'Ubuntu';
    else if (normVer.includes('debian') || normOs.includes('debian')) distro = 'Debian';
    else if (normVer.includes('centos') || normOs.includes('centos')) distro = 'CentOS';
    else if (normVer.includes('fedora') || normOs.includes('fedora')) distro = 'Fedora';
    else if (normVer.includes('redhat') || normVer.includes('rhel')) distro = 'Red Hat';
    else if (normVer.includes('arch')) distro = 'Arch';
    else if (normVer.includes('alpine')) distro = 'Alpine';

    return { name: distro, shortLabel: distro, type: 'linux' };
  }

  // macOS
  if (
    normOs.includes('mac') ||
    normOs.includes('darwin') ||
    normOs.includes('apple')
  ) {
    return { name: 'macOS', shortLabel: 'macOS', type: 'mac' };
  }

  return { name: os || 'Desconhecido', shortLabel: os || 'Host', type: 'other' };
}
