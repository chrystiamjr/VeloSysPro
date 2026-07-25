---
sidebar_position: 1
---

# Introdução

Bem-vindo ao **VeloSys Pro**, um aplicativo desktop de alta performance para otimização do Windows, manutenção, ajustes de jogos, backup de registro e recuperação de sistema desenvolvido pela **Envolvo Systems LTDA.**

![Painel do VeloSys Pro](/img/screenshots/dashboard.png)

## Principais Recursos

- 🚀 **Otimização Rápida e Completa**: Limpeza automatizada de DNS, arquivos temporários, `sfc /scannow` e reparo de imagem com DISM.
- 🎮 **Modo Gaming**: Ajuste da pilha TCP (RSS, Autotuning) para menor latência de rede e desempenho estável em jogos.
- 🧹 **Manutenção do Sistema**: Limpeza do cache do Windows Update, pasta Prefetch e relatório de saúde do disco físico (SMART).
- 💾 **Backup e Restauração de Registro**: Exportação e importação segura de configurações de rede TCP/IP em `.reg` com telas de confirmação.
- 🛡️ **Pontos de Restauração**: Listagem, criação e restauração de pontos do sistema do Windows.
- 📅 **Agendamento Automatizado**: Configuração de tarefas recorrentes via Agendador de Tarefas do Windows ou execução headless via CLI (`--task=<modo>`).
- ⚙️ **Configurações**: Preferências persistentes de idioma e backup de segurança, além da verificação de atualizações no app.
- 🌐 **Interface Bilíngue**: Alternância instantânea entre Inglês (US) 🇺🇸 e Português (BR) 🇧🇷.

## Requisitos do Sistema

- **Sistema Operacional**: Windows 10 ou Windows 11 (64-bit).
- **Privilégios**: Direitos de Administrador necessários (prompt UAC ao iniciar).
- **Runtime**: Microsoft WebView2 Runtime (pré-instalado no Windows 11 e versões recentes do Windows 10).
- **Standalone**: Sem necessidade de instalação do SDK do .NET (o executável é autocontido).
