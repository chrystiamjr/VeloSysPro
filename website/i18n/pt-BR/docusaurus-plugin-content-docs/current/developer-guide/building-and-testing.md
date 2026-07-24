---
sidebar_position: 3
---

# Compilação e Testes

## Configuração do Ambiente de Desenvolvimento

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/chrystiamjr/VeloSysPro.git
cd VeloSysPro
npm install
npm run setup-hooks
```

## Executando Testes

- **Validação do Frontend** (TypeScript + Prettier + ESLint + Vitest):
  ```bash
  npm run validate
  ```

- **Testes Unitários do Backend** (xUnit):
  ```bash
  dotnet test desktop.Tests/VeloSysPro.Tests.csproj -c Release
  ```

## Compilando o Executável e o Instalador

Para compilar o bundle do Vite, gerar o executável `.exe` único e empacotar o instalador Inno Setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Os artefatos finais serão salvos em `dist/VeloSysPro-Setup-<versao>.exe`.
