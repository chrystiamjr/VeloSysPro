---
sidebar_position: 3
---

# Building & Testing

## Development Setup {#development-setup}

Clone the repository and install dependencies:

```bash
git clone https://github.com/chrystiamjr/VeloSysPro.git
cd VeloSysPro
npm install
npm run setup-hooks
```

## Running Tests {#running-tests}

- **Frontend Validation** (TypeScript + Prettier + ESLint + Vitest):
  ```bash
  npm run validate
  ```

- **Backend Unit Tests** (xUnit):
  ```bash
  dotnet test desktop.Tests/VeloSysPro.Tests.csproj -c Release
  ```

## Building the Executable & Installer {#building-the-executable--installer}

To build the Vite bundle, compile the single `.exe`, and package the Inno Setup installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

The output artifacts will be placed in `dist/VeloSysPro-Setup-<version>.exe`.
