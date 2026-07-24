---
sidebar_position: 4
---

# Agendamento Automatizado e CLI

O VeloSys Pro pode ser executado de forma silenciosa em segundo plano via argumentos de linha de comando ou tarefas agendadas do Windows.

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

A partir da aba **Scheduler** na interface:
- Configure gatilhos diários ou semanais de otimização.
- O VeloSys Pro registra tarefas nativas no Agendador de Tarefas do Windows que executam `VeloSysPro.exe --task=...` automaticamente.
