---
sidebar_position: 1
---

# Otimizações do Sistema

O VeloSys Pro oferece perfis de otimização sob medida para manter o seu sistema operacional rápido e responsivo.

![Painel de otimizações do VeloSys Pro](/img/screenshots/dashboard.png)

## Otimização Rápida
Uma rotina ágil projetada para a manutenção diária:
- Limpa o cache do Resolvedor DNS do Windows (`ipconfig /flushdns`).
- Elimina arquivos temporários de usuário (`%TEMP%` e `%WINDIR%\Temp`).
- Limpa caches do sistema.

## Otimização Completa
Uma suíte abrangente de limpeza profunda e reparos:
- Executa o Verificador de Arquivos do Sistema (`sfc /scannow`) para reparar arquivos corrompidos.
- Executa a Ferramenta de Gerenciamento e Manutenção de Imagens de Implantação (`DISM.exe /Online /Cleanup-Image /RestoreHealth`).
- Realiza limpeza profunda do disco e caches de atualizações.

## Modo Gaming
Otimiza a responsividade da rede para jogos online:
- Ativa o Receive-Side Scaling (RSS) nos adaptadores de rede.
- Define o nível de Auto-Ajuste da Janela TCP para `normal`.
- Ativa a Notificação Explícita de Congestionamento (ECN) para reduzir picos de latência.

## Reverter Padrões
Restaura todas as configurações da pilha de rede para os padrões originais do Windows (`netsh int ip reset`, `netsh winsock reset`).
