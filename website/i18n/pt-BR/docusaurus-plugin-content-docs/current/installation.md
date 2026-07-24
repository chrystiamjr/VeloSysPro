---
sidebar_position: 2
---

# Instalação e Uso

## Baixando o VeloSys Pro

Você pode baixar a versão mais recente diretamente na página de [Releases do GitHub](https://github.com/chrystiamjr/VeloSysPro/releases).

Disponibilizamos dois formatos:
1. **`VeloSysPro-Setup-<versao>.exe` (Recomendado)**: Um instalador Inno Setup que configura atalhos no Menu Iniciar e instala o Microsoft WebView2 Runtime automaticamente caso necessário.
2. **`VeloSysPro.exe`**: Um executável portátil único que não requer instalação.

## Executando o Aplicativo

1. Dê um duplo clique no arquivo **`VeloSysPro.exe`** ou no atalho instalado.
2. Aceite o prompt do **Controle de Conta de Usuário (UAC)**. Direitos de Administrador são necessários para executar comandos de sistema (`sfc`, `dism`, `netsh` e chamadas de Restauração do Sistema).

:::note Aviso do SmartScreen
Como os executáveis do VeloSys Pro são assinados por fluxos de release da comunidade, o Windows SmartScreen pode exibir a mensagem *"O Windows protegeu o seu PC"*. Clique em **Mais informações → Executar assim mesmo** para prosseguir com segurança.
:::
