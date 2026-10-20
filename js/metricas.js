/**
 * metricas.js
 * Controlador da Página Oculta de Inteligência e Dados das Máquinas (metricas.html)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o tracker e busca os dados atuais direto do arquivo JSON do servidor
  AccessTracker.fetchServerData();

  // Sincronização periódica com o servidor a cada 3 segundos para capturar novos acessos em tempo real
  setInterval(() => {
  AccessTracker.fetchServerData().catch(err => {
    console.error('Falha ao atualizar métricas:', err);
  });
}, 3000);

  const currentMachineId = DeviceInfo.getMachineId();
  const currentDeviceInfo = DeviceInfo.collectData();

  // Elementos do DOM
  const kpiUniqueMachines = document.getElementById('kpiUniqueMachines');
  const kpiTestsCount = document.getElementById('kpiTestsCount');
  const kpiActiveTime = document.getElementById('kpiActiveTime');
  const machinesCountBadge = document.getElementById('machinesCountBadge');

  const machinesTableBody = document.getElementById('machinesTableBody');
  const testsTableBody = document.getElementById('testsTableBody');

  const btnSimulateMachine = document.getElementById('btnSimulateMachine');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const btnResetAll = document.getElementById('btnResetAll');
  const btnRefresh = document.getElementById('btnRefresh');
  const adminToast = document.getElementById('adminToast');

  // Toast
  let toastTimer = null;
  function showToast(message) {
    if (!adminToast) return;
    clearTimeout(toastTimer);
    adminToast.textContent = message;
    adminToast.classList.add('show');
    toastTimer = setTimeout(() => {
      adminToast.classList.remove('show');
    }, 3500);
  }

  // Formatação de data/hora
  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;
    } catch (e) {
      return isoString;
    }
  }

  // Renderização da tabela de máquinas
  function renderMachinesTable(machinesList) {
    if (!machinesTableBody) return;

    if (!machinesList || machinesList.length === 0) {
      machinesTableBody.innerHTML = `
        <tr>
          <td colspan="15" style="text-align: center; color: #94a3b8; padding: 24px;">
            Nenhuma máquina registrada ainda.
          </td>
        </tr>
      `;
      return;
    }

    machinesTableBody.innerHTML = machinesList.map(machine => {
      const isCurrent = machine.id === currentMachineId;
      const isSim = machine.isSimulated;

      return `
        <tr class="${isCurrent ? 'current-machine-row' : ''}">
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="machine-id-badge">${machine.id}</span>
              ${isCurrent ? '<span class="tag-you">Você</span>' : ''}
              ${isSim ? '<span class="tag-sim">Simulada</span>' : ''}
            </div>
          </td>
          <td><span class="ip-badge">${machine.ip || 'Detectando...'}</span></td>
          <td><span class="hostname-badge">${machine.hostname || 'Detectando...'}</span></td>
          <td><strong>${machine.os || 'Desconhecido'}</strong></td>
          <td>${machine.browser || 'Navegador'}</td>
          <td><code>${machine.screen || '-'}</code></td>
          <td><code>${machine.viewport || machine.screen || '-'}</code></td>
          <td>${machine.pixelRatio || '1x'}</td>
          <td>${machine.language || 'pt-BR'}</td>
          <td>${machine.timeZone || 'UTC'}</td>
          <td>${machine.cores ? machine.cores + ' CPUs' : '-'} • ${machine.memory || '-'}</td>
          <td>${machine.isTouch || 'Não'}</td>
          <td>
            <span style="color: ${machine.isOnline === 'Online' ? '#10b981' : '#64748b'}; font-weight: 600;">
              ● ${machine.isOnline || 'Online'}
            </span>
          </td>
          <td><code style="font-size: 11px; color: #6366f1;">${machine.hardwareHash || machine.id}</code></td>
          <td>
            <span class="visit-badge">${machine.visitsCount} ${machine.visitsCount > 1 ? 'acessos' : 'acesso'}</span>
          </td>
          <td style="font-size: 11.5px; color: #64748b;">${formatDate(machine.firstSeen)}</td>
          <td style="font-size: 11.5px; color: #334155; font-weight: 600;">${formatDate(machine.lastSeen)}</td>
        </tr>
      `;
    }).join('');
  }

  // Renderização da tabela de tentativas de autenticação (apenas horário e usuário nublado)
  function renderTestsTable(testsHistory) {
    if (!testsTableBody) return;

    if (!testsHistory || testsHistory.length === 0) {
      testsTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: #94a3b8; padding: 24px;">
            Nenhuma tentativa de acesso submetida ainda. Realize tentativas na página principal para registrar aqui.
          </td>
        </tr>
      `;
      return;
    }

    testsTableBody.innerHTML = testsHistory.map(test => `
      <tr>
        <td>
          <strong style="color: #0f172a; font-family: monospace; font-size: 13px;">
            🕒 ${test.timeOnly || test.timestamp || '-'}
          </strong>
        </td>
        <td>
          <span class="censored-user" title="Dado anonimizado/nublado para proteção de privacidade">${test.maskedUser || (test.details && test.details.username ? '••••••••' : '••••••••')}</span>
        </td>
        <td>
          <span style="background: #f1f5f9; color: #334155; font-weight: 700; padding: 3px 10px; border-radius: 4px; font-size: 11.5px; border: 1px solid #cbd5e1;">
            ● ${test.status || 'Tentativa Registrada (Teste)'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // Inscrição reativa para atualizações
  AccessTracker.subscribe(stats => {
    try {
      if (kpiUniqueMachines) kpiUniqueMachines.textContent = stats.uniqueMachinesCount;
      if (kpiTestsCount) kpiTestsCount.textContent = stats.testsCount;
      if (machinesCountBadge) {
        machinesCountBadge.textContent = `${stats.uniqueMachinesCount} ${stats.uniqueMachinesCount > 1 ? 'máquinas' : 'máquina'}`;
      }

      renderMachinesTable(stats.machinesList);
      renderTestsTable(stats.testsHistory);
    } catch (err) {
      console.error('Erro ao atualizar métricas:', err);
    }
  });

  // Atualização do cronômetro de tempo ativo a cada 1 segundo
  setInterval(() => {
    try {
      const stats = AccessTracker.getStats();
      if (kpiActiveTime) {
        kpiActiveTime.textContent = stats.activeTimeFormatted;
      }
    } catch (err) {
      console.error('Erro no cronômetro:', err);
    }
  }, 1000);

  // Ações de botões
  if (btnSimulateMachine) {
    btnSimulateMachine.addEventListener('click', () => {
      AccessTracker.simulateNewMachine();
      showToast('Nova máquina simulada com sucesso!');
    });
  }

  if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;

    try {
      await AccessTracker.fetchServerData();
      showToast('Métricas atualizadas.');
    } catch (err) {
      console.error(err);
      showToast('Falha ao consultar as métricas. Nada foi apagado.');
    } finally {
      btnRefresh.disabled = false;
    }
  });
}

  if (btnResetAll) {
  btnResetAll.addEventListener('click', async () => {
    if (!confirm('Deseja limpar todos os registros da campanha?')) {
      return;
    }

    btnResetAll.disabled = true;

    try {
      await AccessTracker.clearServerData();
      showToast('Registros apagados com sucesso.');
    } catch (err) {
      console.error(err);
      showToast('Não foi possível confirmar a limpeza.');
    } finally {
      btnResetAll.disabled = false;
    }
  });
}

  // Exportar dados como JSON
  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      const stats = AccessTracker.getStats();
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalMachines: stats.uniqueMachinesCount,
        totalVisits: stats.totalVisitsCount,
        totalTests: stats.testsCount,
        machines: stats.machinesList,
        testsHistory: stats.testsHistory
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `totvs_dados_maquinas_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Arquivo JSON gerado e baixado!');
    });
  }

  // Exportar dados como CSV
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      const stats = AccessTracker.getStats();
      const headers = [
        'ID_Maquina',
        'Endereco_IP',
        'Hostname',
        'Sistema_Operacional',
        'Navegador',
        'Resolucao_Tela',
        'Viewport',
        'Densidade_Pixels',
        'Idioma',
        'Fuso_Horario',
        'Touchscreen',
        'Status_Rede',
        'Total_Acessos',
        'Primeiro_Acesso',
        'Ultimo_Acesso',
        'Simulada'
      ];

      const rows = stats.machinesList.map(m => [
        `"${m.id}"`,
        `"${m.ip || '127.0.0.1'}"`,
        `"${m.hostname || 'Host Local'}"`,
        `"${m.os}"`,
        `"${m.browser}"`,
        `"${m.screen}"`,
        `"${m.viewport || m.screen}"`,
        `"${m.pixelRatio || '1x'}"`,
        `"${m.language}"`,
        `"${m.timeZone}"`,
        `"${m.isTouch || 'Não'}"`,
        `"${m.isOnline || 'Online'}"`,
        m.visitsCount,
        `"${m.firstSeen}"`,
        `"${m.lastSeen}"`,
        m.isSimulated ? 'Sim' : 'Não'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `totvs_dados_maquinas_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Arquivo CSV gerado e baixado!');
    });
  }
});
