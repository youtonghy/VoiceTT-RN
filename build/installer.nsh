!include "LogicLib.nsh"

!define /ifndef INSTALL_REGISTRY_KEY "Software\\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${UNINSTALL_APP_KEY}"

!ifndef BUILD_UNINSTALLER
Function RemoveInstallHKCU
  Push $0

  ClearErrors
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $0 != ""
    IfFileExists "$0\\*.*" 0 done_hkcu
    DetailPrint `Removing previous install from "$0".`
    ClearErrors
    RMDir /r "$0"
    IfErrors 0 done_hkcu
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retry_hkcu
    Quit
    retry_hkcu:
      ClearErrors
      RMDir /r "$0"
      IfErrors 0 done_hkcu
      Quit
    done_hkcu:
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  ${endIf}

  Pop $0
FunctionEnd

Function RemoveInstallHKLM
  Push $0

  ClearErrors
  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $0 != ""
    IfFileExists "$0\\*.*" 0 done_hklm
    DetailPrint `Removing previous install from "$0".`
    ClearErrors
    RMDir /r "$0"
    IfErrors 0 done_hklm
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retry_hklm
    Quit
    retry_hklm:
      ClearErrors
      RMDir /r "$0"
      IfErrors 0 done_hklm
      Quit
    done_hklm:
    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  ${endIf}

  Pop $0
FunctionEnd

Function PreInstallCleanup
  Push $0

  Call RemoveInstallHKCU
  Call RemoveInstallHKLM

  Pop $0
FunctionEnd

!macro customInit
  Call PreInstallCleanup
!macroend
!endif

!macro customCheckAppRunning
  ; Skip the default process check to avoid false positives.
!macroend
