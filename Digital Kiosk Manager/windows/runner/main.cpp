#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>

#include "flutter_window.h"
#include "utils.h"

namespace {

void SetAppUserModelIdIfAvailable() {
  using SetAppUserModelIdFn = HRESULT(WINAPI*)(PCWSTR);

  HMODULE shell32 = ::GetModuleHandleW(L"shell32.dll");
  if (!shell32) {
    shell32 = ::LoadLibraryW(L"shell32.dll");
  }
  if (!shell32) {
    return;
  }

  const auto set_app_id = reinterpret_cast<SetAppUserModelIdFn>(
      ::GetProcAddress(shell32, "SetCurrentProcessExplicitAppUserModelID"));
  if (set_app_id) {
    set_app_id(L"com.stravaxx.digital-kiosk.manager");
  }
}

}  // namespace

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t *command_line, _In_ int show_command) {
  // Ensures taskbar pinning and Windows notifications use this app identity/icon.
  SetAppUserModelIdIfAvailable();

  // Attach to console when present (e.g., 'flutter run') or create a
  // new console when running with a debugger.
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  // Initialize COM, so that it is available for use in the library and/or
  // plugins.
  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  flutter::DartProject project(L"data");

  std::vector<std::string> command_line_arguments =
      GetCommandLineArguments();

  project.set_dart_entrypoint_arguments(std::move(command_line_arguments));

  FlutterWindow window(project);
  Win32Window::Point origin(10, 10);
  Win32Window::Size size(1280, 720);
  if (!window.Create(L"Digital Kiosk Manager", origin, size)) {
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);

  ::MSG msg;
  while (::GetMessage(&msg, nullptr, 0, 0)) {
    ::TranslateMessage(&msg);
    ::DispatchMessage(&msg);
  }

  ::CoUninitialize();
  return EXIT_SUCCESS;
}
