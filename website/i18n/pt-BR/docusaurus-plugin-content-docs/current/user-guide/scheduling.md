---
sidebar_position: 4
---

# Agendamento Automatizado e CLI

O VeloSys Pro pode ser executado de forma silenciosa em segundo plano via argumentos de linha de comando ou tarefas agendadas do Windows.

![Tela de Agendamento Automatizado](/img/screenshots/scheduling.png)

## Uso via Linha de Comando (CLI)

Execute tarefas diretamente pelo Prompt de Comando ou PowerShell:

```powershell
.\VeloSysPro.exe --task=quick
.\VeloSysPro.exe --task=full
.\VeloSysPro.exe --task=gaming
.\VeloSysPro.exe --task=revert
```

Ao utilizar `--task=<modo>`, o VeloSys Pro executa em modo headless sem abrir a interface WebView2, registrando logs em `%LOCALAPPDATA%\VeloSysPro\logs` e encerrando com código `0` em caso de sucesso.

## Integração com o Agendador de Tarefas do Windows

A partir da aba **Agendamento** na interface:
- Escolha uma otimização, uma frequência e um horário. Agendamentos semanais exibem um seletor de dia da semana, e mensais um seletor de dia do mês.
- O VeloSys Pro registra tarefas nativas no Agendador de Tarefas do Windows que executam `VeloSysPro.exe --task=...` automaticamente.

### Múltiplos agendamentos por otimização

Cada agendamento vira uma tarefa distinta do Windows, então a mesma otimização pode rodar mais de uma vez — uma Otimização Rápida às 03:00 e outra às 05:00 coexistem em vez de uma substituir a outra.

O nome da tarefa codifica todo o agendamento:

| Nome da tarefa | Significado |
| :--- | :--- |
| `VeloSysPro_Quick_Daily_0300` | Otimização Rápida, todos os dias às 03:00 |
| `VeloSysPro_Gaming_Weekly_MON_0430` | Modo Gaming, toda segunda-feira às 04:30 |
| `VeloSysPro_Full_Monthly_15_0200` | Otimização Completa, dia 15 de cada mês às 02:00 |

Como o nome carrega o agendamento, o Agendador de Tarefas do Windows permanece a única fonte de verdade: não existe índice paralelo para desincronizar. Excluir uma tarefa pelo `taskschd.msc` também a remove da lista do aplicativo, e recriar um agendamento idêntico o sobrescreve em vez de duplicar.

### Lista de tarefas agendadas

A tabela mostra o nome amigável (`Diária - Otimização Rápida`), a cadência concreta (`Todos os dias às 03:00`), o estado da tarefa e a ação de remover. As colunas são ordenáveis e a lista pagina a cada 10 linhas.

Tarefas criadas por versões anteriores (nomeadas `VeloSysPro_Quick`, sem sufixo de agendamento) continuam listadas e removíveis; a coluna de cadência exibe `—`.
