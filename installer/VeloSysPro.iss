; VeloSys Pro - Inno Setup installer script
; Compile with: ISCC.exe installer\VeloSysPro.iss  (optionally /DAppVersion=1.2.3)
; Requires the published single-file exe at dist\VeloSysPro.exe (produced by build.ps1).

#ifndef AppVersion
  #define AppVersion "0.1.6"
#endif

#define AppName "VeloSys Pro"
#define AppPublisher "Envolvo Systems LTDA."
#define AppExe "VeloSysPro.exe"
; Official Evergreen WebView2 Runtime bootstrapper permalink.
#define WebView2Bootstrapper "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
AppId={{9B7E5C42-4E1A-4C7D-9F2A-VELOSYSPRO01}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=VeloSysPro-Setup-{#AppVersion}
SetupIconFile=..\desktop\assets\app.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; The app performs administrative optimizations, so require elevation.
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
UninstallDisplayIcon={app}\{#AppExe}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
; Install the Evergreen WebView2 Runtime only when it is missing.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""$ErrorActionPreference='Stop'; $o=Join-Path $env:TEMP 'MicrosoftEdgeWebview2Setup.exe'; Invoke-WebRequest -Uri '{#WebView2Bootstrapper}' -OutFile $o; Start-Process -Wait -FilePath $o -ArgumentList '/silent','/install'"""; \
  StatusMsg: "Installing Microsoft WebView2 Runtime..."; \
  Flags: runhidden waituntilterminated; \
  Check: WebView2Missing

; Optionally launch the app after install.
; shellexec is required, not cosmetic: Inno runs postinstall entries as the original
; (non-elevated) user, and plain CreateProcess cannot raise a UAC prompt -- against this
; exe's requireAdministrator manifest it fails outright with code 740
; (ERROR_ELEVATION_REQUIRED) before the process exists, so nothing reaches the app log.
; ShellExecuteEx honours the manifest and elevates.
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent shellexec

[Code]
function WebView2ClientPresent(RootKey: Integer; const SubKey: String): Boolean;
var
  pv: String;
begin
  Result := RegQueryStringValue(RootKey, SubKey, 'pv', pv) and (pv <> '') and (pv <> '0.0.0.0');
end;

// True when no compatible WebView2 Runtime is registered (per-machine or per-user).
function WebView2Missing: Boolean;
var
  ClientKey, ClientKeyWow: String;
begin
  ClientKey := 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  ClientKeyWow := 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := not (
    WebView2ClientPresent(HKLM, ClientKeyWow) or
    WebView2ClientPresent(HKLM, ClientKey) or
    WebView2ClientPresent(HKCU, ClientKey)
  );
end;
