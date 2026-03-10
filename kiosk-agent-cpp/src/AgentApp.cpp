#include "agent/AgentApp.hpp"

#include <chrono>
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <thread>

#if defined(PLATFORM_WINDOWS)
#include <windows.h>
#endif

#if defined(PLATFORM_WINDOWS)
namespace {

struct WindowsMonitorInfo {
  int index;
  RECT rect;
  bool isPrimary;
};

BOOL CALLBACK CollectMonitorsProc(HMONITOR monitor, HDC, LPRECT, LPARAM userData) {
  if (!userData) return FALSE;
  auto* out = reinterpret_cast<std::vector<WindowsMonitorInfo>*>(userData);

  MONITORINFOEXA monitorInfo{};
  monitorInfo.cbSize = sizeof(monitorInfo);
  if (!GetMonitorInfoA(monitor, &monitorInfo)) return TRUE;

  WindowsMonitorInfo entry{};
  entry.index = static_cast<int>(out->size()) + 1;
  entry.rect = monitorInfo.rcMonitor;
  entry.isPrimary = (monitorInfo.dwFlags & MONITORINFOF_PRIMARY) != 0;
  out->push_back(entry);
  return TRUE;
}

std::vector<WindowsMonitorInfo> listWindowsMonitors() {
  std::vector<WindowsMonitorInfo> monitors;
  EnumDisplayMonitors(nullptr, nullptr, CollectMonitorsProc, reinterpret_cast<LPARAM>(&monitors));
  return monitors;
}

int parseMonitorIndexFromEnv(const char* raw, int total) {
  if (!raw || total <= 0) return -1;
  try {
    const int parsed = std::stoi(std::string(raw));
    if (parsed >= 1 && parsed <= total) return parsed - 1;
  } catch (...) {
    return -1;
  }
  return -1;
}

bool parseAllMonitorsFromEnv(const char* raw) {
  if (!raw) return false;
  std::string value = std::string(raw);
  const auto begin = value.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos) return false;
  const auto end = value.find_last_not_of(" \t\r\n");
  value = value.substr(begin, end - begin + 1);
  for (char& ch : value) {
    ch = static_cast<char>(::tolower(static_cast<unsigned char>(ch)));
  }
  return value == "all" || value == "*";
}

int chooseTargetMonitorIndex(const std::vector<WindowsMonitorInfo>& monitors) {
  if (monitors.empty()) return -1;
  if (monitors.size() == 1) return 0;

  const char* envRaw = std::getenv("KIOSK_TARGET_MONITOR");
  if (parseAllMonitorsFromEnv(envRaw)) return -2;

  const int envIndex = parseMonitorIndexFromEnv(envRaw, static_cast<int>(monitors.size()));
  if (envIndex >= 0) return envIndex;

  if (!GetConsoleWindow()) {
    return -2;
  }

  std::cout << "[INFO] Écrans détectés pour kiosk Windows:" << std::endl;
  for (const auto& monitor : monitors) {
    const int width = monitor.rect.right - monitor.rect.left;
    const int height = monitor.rect.bottom - monitor.rect.top;
    std::cout
      << "  " << monitor.index << ") "
      << width << "x" << height
      << " @(" << monitor.rect.left << "," << monitor.rect.top << ")"
      << (monitor.isPrimary ? " [primaire]" : "")
      << std::endl;
  }

  std::cout << "Choisir l'écran kiosk (Entrée=tous): ";
  std::string input;
  std::getline(std::cin, input);
  if (input.empty()) return -2;

  try {
    const int parsed = std::stoi(input);
    if (parsed >= 1 && parsed <= static_cast<int>(monitors.size())) {
      return parsed - 1;
    }
  } catch (...) {
    return -2;
  }

  return -2;
}

bool hasArgWithPrefix(const std::vector<std::string>& args, const std::string& prefix) {
  for (const auto& arg : args) {
    if (arg.rfind(prefix, 0) == 0) return true;
  }
  return false;
}

std::vector<std::string> withMonitorPlacementArgs(
  const std::vector<std::string>& baseArgs,
  const WindowsMonitorInfo& monitor
) {
  std::vector<std::string> args = baseArgs;

  const int width = monitor.rect.right - monitor.rect.left;
  const int height = monitor.rect.bottom - monitor.rect.top;
  if (width <= 0 || height <= 0) {
    return args;
  }

  if (!hasArgWithPrefix(args, "--window-position=")) {
    args.push_back("--window-position=" + std::to_string(monitor.rect.left) + "," + std::to_string(monitor.rect.top));
  }

  if (!hasArgWithPrefix(args, "--window-size=")) {
    args.push_back("--window-size=" + std::to_string(width) + "," + std::to_string(height));
  }

  if (!hasArgWithPrefix(args, "--start-fullscreen")) {
    args.push_back("--start-fullscreen");
  }

  return args;
}

} // namespace
#endif

namespace agent {

AgentApp::AgentApp(std::string configPath)
  : configPath_(std::move(configPath)) {}

int AgentApp::run() {
  log("INFO", "Kiosk Agent C++ starting...");

  if (!loadConfig()) {
    log("ERROR", "Unable to load config file.");
    return 1;
  }

  if (!startRendererHost()) {
    log("ERROR", "Renderer host failed to start.");
    return 2;
  }

  if (!startSyncLoop()) {
    log("ERROR", "Sync loop failed to initialize.");
    return 3;
  }

  if (!startWatchdogLoop()) {
    log("ERROR", "Watchdog loop failed to initialize.");
    return 4;
  }

  log("INFO", "Agent loops initialized. Running main heartbeat.");
  while (true) {
    log("DEBUG", "Agent heartbeat tick.");
    std::this_thread::sleep_for(std::chrono::seconds(30));
  }

  return 0;
}

void AgentApp::log(const std::string& level, const std::string& message) const {
  std::cout << "[" << level << "] " << message << std::endl;
}

std::string AgentApp::readTextFile(const std::string& filePath) {
  std::ifstream input(filePath, std::ios::in | std::ios::binary);
  if (!input) return {};
  std::ostringstream out;
  out << input.rdbuf();
  return out.str();
}

std::string AgentApp::trim(const std::string& value) {
  const auto begin = value.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos) return {};
  const auto end = value.find_last_not_of(" \t\r\n");
  return value.substr(begin, end - begin + 1);
}

std::string AgentApp::extractJsonString(const std::string& source, const std::string& key) {
  const std::string marker = "\"" + key + "\"";
  const auto markerPos = source.find(marker);
  if (markerPos == std::string::npos) return {};
  const auto colonPos = source.find(':', markerPos + marker.size());
  if (colonPos == std::string::npos) return {};
  const auto firstQuote = source.find('"', colonPos + 1);
  if (firstQuote == std::string::npos) return {};
  std::string result;
  bool escape = false;
  for (std::size_t i = firstQuote + 1; i < source.size(); ++i) {
    const char ch = source[i];
    if (escape) {
      result.push_back(ch);
      escape = false;
      continue;
    }
    if (ch == '\\') {
      escape = true;
      continue;
    }
    if (ch == '"') {
      break;
    }
    result.push_back(ch);
  }
  return trim(result);
}

std::vector<std::string> AgentApp::extractJsonArrayStrings(const std::string& source, const std::string& key) {
  const std::string marker = "\"" + key + "\"";
  const auto markerPos = source.find(marker);
  if (markerPos == std::string::npos) return {};
  const auto colonPos = source.find(':', markerPos + marker.size());
  if (colonPos == std::string::npos) return {};
  const auto openBracket = source.find('[', colonPos + 1);
  if (openBracket == std::string::npos) return {};
  const auto closeBracket = source.find(']', openBracket + 1);
  if (closeBracket == std::string::npos || closeBracket <= openBracket) return {};
  const std::string arrayBody = source.substr(openBracket + 1, closeBracket - openBracket - 1);

  std::vector<std::string> values;
  bool inString = false;
  bool escape = false;
  std::string current;
  for (char ch : arrayBody) {
    if (!inString) {
      if (ch == '"') {
        inString = true;
        current.clear();
      }
      continue;
    }

    if (escape) {
      current.push_back(ch);
      escape = false;
      continue;
    }
    if (ch == '\\') {
      escape = true;
      continue;
    }
    if (ch == '"') {
      values.push_back(trim(current));
      inString = false;
      current.clear();
      continue;
    }
    current.push_back(ch);
  }

  return values;
}

std::string AgentApp::extractJsonObject(const std::string& source, const std::string& key) {
  const std::string marker = "\"" + key + "\"";
  const auto markerPos = source.find(marker);
  if (markerPos == std::string::npos) return {};
  const auto colonPos = source.find(':', markerPos + marker.size());
  if (colonPos == std::string::npos) return {};
  const auto openBrace = source.find('{', colonPos + 1);
  if (openBrace == std::string::npos) return {};

  int depth = 0;
  bool inString = false;
  bool escape = false;
  for (std::size_t i = openBrace; i < source.size(); ++i) {
    const char ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch == '\\') {
        escape = true;
      } else if (ch == '"') {
        inString = false;
      }
      continue;
    }

    if (ch == '"') {
      inString = true;
      continue;
    }
    if (ch == '{') {
      ++depth;
      continue;
    }
    if (ch == '}') {
      --depth;
      if (depth == 0) {
        return source.substr(openBrace, i - openBrace + 1);
      }
    }
  }

  return {};
}

std::string AgentApp::shellEscape(const std::string& value) {
  std::string escaped = "\"";
  for (char ch : value) {
    if (ch == '"') escaped += '\\';
    escaped += ch;
  }
  escaped += "\"";
  return escaped;
}

bool AgentApp::launchDetachedWindows(const std::string& command, const std::vector<std::string>& args) {
  if (command.empty()) return false;
  std::string composed = "start \"\" " + shellEscape(command);
  for (const auto& arg : args) {
    composed += " " + shellEscape(arg);
  }
  const std::string fullCommand = "cmd /c " + composed;
  return std::system(fullCommand.c_str()) == 0;
}

bool AgentApp::launchDetachedLinux(const std::string& command, const std::vector<std::string>& args) {
  if (command.empty()) return false;
  std::string composed = command;
  for (const auto& arg : args) {
    composed += " " + shellEscape(arg);
  }
  composed += " >/dev/null 2>&1 &";
  return std::system(composed.c_str()) == 0;
}

bool AgentApp::loadConfig() {
  log("INFO", "Loading config: " + configPath_);
  rawConfig_ = readTextFile(configPath_);
  if (rawConfig_.empty()) {
    log("WARN", "Config file unreadable, using defaults.");
  }

  const std::string rendererObj = extractJsonObject(rawConfig_, "renderer");
  const std::string windowsObj = extractJsonObject(rendererObj, "windows");
  const std::string linuxObj = extractJsonObject(rendererObj, "linux");

  windowsRenderer_.command = extractJsonString(windowsObj, "command");
  windowsRenderer_.args = extractJsonArrayStrings(windowsObj, "args");

  const std::string defaultUrl = "http://127.0.0.1:4173/player";
  if (windowsRenderer_.command.empty()) {
    windowsRenderer_.command = "msedge.exe";
    windowsRenderer_.args = {
      "--kiosk",
      defaultUrl,
      "--edge-kiosk-type=fullscreen",
      "--no-first-run",
      "--disable-features=Translate,TranslateUI,msEdgeTranslate"
    };
  }

  linuxRenderer_ = {
    "/usr/bin/chromium-browser",
    {"--kiosk", "--start-fullscreen", defaultUrl}
  };

  const std::string configuredLinuxCommand = extractJsonString(linuxObj, "command");
  if (!configuredLinuxCommand.empty()) {
    linuxRenderer_.command = configuredLinuxCommand;
  }
  const std::vector<std::string> configuredLinuxArgs = extractJsonArrayStrings(linuxObj, "args");
  if (!configuredLinuxArgs.empty()) {
    linuxRenderer_.args = configuredLinuxArgs;
  }

  return true;
}

bool AgentApp::startRendererHost() const {
#if defined(PLATFORM_WINDOWS)
  log("INFO", "Starting Windows renderer host (fallback browser kiosk mode).");

  const auto monitors = listWindowsMonitors();
  const int targetMonitorIndex = chooseTargetMonitorIndex(monitors);
  std::vector<int> targetMonitorIndices;
  if (targetMonitorIndex == -2 && !monitors.empty()) {
    targetMonitorIndices.reserve(monitors.size());
    for (int i = 0; i < static_cast<int>(monitors.size()); ++i) {
      targetMonitorIndices.push_back(i);
    }
  } else if (targetMonitorIndex >= 0 && targetMonitorIndex < static_cast<int>(monitors.size())) {
    targetMonitorIndices.push_back(targetMonitorIndex);
  }

  if (targetMonitorIndices.empty()) {
    log("INFO", "Windows kiosk target monitor: auto");
  } else if (targetMonitorIndices.size() == 1) {
    log("INFO", "Windows kiosk target monitor: " + std::to_string(monitors[targetMonitorIndices.front()].index));
  } else {
    log("INFO", "Windows kiosk target monitor: tous les écrans détectés");
  }

  const auto launchOnTargets = [&](const std::string& command, const std::vector<std::string>& baseArgs) {
    if (targetMonitorIndices.empty()) {
      return launchDetachedWindows(command, baseArgs);
    }

    bool launched = false;
    for (int monitorIdx : targetMonitorIndices) {
      if (monitorIdx < 0 || monitorIdx >= static_cast<int>(monitors.size())) continue;
      if (launchDetachedWindows(command, withMonitorPlacementArgs(baseArgs, monitors[monitorIdx]))) {
        launched = true;
      }
    }
    return launched;
  };

  if (launchOnTargets(windowsRenderer_.command, windowsRenderer_.args)) {
    log("INFO", "Renderer launched from configured Windows command.");
    return true;
  }

  const std::string defaultUrl = "http://127.0.0.1:4173/player";
  if (launchOnTargets("msedge.exe", {
    "--kiosk",
    defaultUrl,
    "--edge-kiosk-type=fullscreen",
    "--no-first-run",
    "--disable-features=Translate,TranslateUI,msEdgeTranslate"
  })) {
    log("WARN", "Configured renderer failed, fallback to Edge kiosk succeeded.");
    return true;
  }
  if (launchOnTargets("chrome.exe", {"--kiosk", defaultUrl})) {
    log("WARN", "Configured renderer failed, fallback to Chrome kiosk succeeded.");
    return true;
  }
  if (launchDetachedWindows("explorer.exe", {defaultUrl})) {
    log("WARN", "Configured renderer failed, fallback to system browser succeeded.");
    return true;
  }

  log("ERROR", "Unable to start renderer on Windows. Check Edge/Chrome install or renderer config.");
  return false;
#else
  log("INFO", "Starting Linux renderer host (Chromium/WPE kiosk).");
  const std::string defaultUrl = "http://127.0.0.1:4173/player";

  if (launchDetachedLinux(linuxRenderer_.command, linuxRenderer_.args)) {
    log("INFO", "Linux renderer launched from configured command.");
    return true;
  }
  if (launchDetachedLinux("chromium-browser", {"--kiosk", "--start-fullscreen", defaultUrl})) {
    log("WARN", "Configured Linux renderer failed, fallback to chromium-browser succeeded.");
    return true;
  }
  if (launchDetachedLinux("chromium", {"--kiosk", "--start-fullscreen", defaultUrl})) {
    log("WARN", "Configured Linux renderer failed, fallback to chromium succeeded.");
    return true;
  }
  if (launchDetachedLinux("cog", {defaultUrl})) {
    log("WARN", "Configured Linux renderer failed, fallback to Cog (WPE) succeeded.");
    return true;
  }
  if (launchDetachedLinux("xdg-open", {defaultUrl})) {
    log("WARN", "Configured Linux renderer failed, fallback to xdg-open succeeded.");
    return true;
  }

  log("ERROR", "Unable to start renderer on Linux. Install chromium-browser/chromium/cog.");
  return false;
#endif
}

bool AgentApp::startSyncLoop() const {
  log("INFO", "Starting backend sync loop (authorize/bootstrap/heartbeat).");
  return true;
}

bool AgentApp::startWatchdogLoop() const {
  log("INFO", "Starting watchdog loop.");
  return true;
}

} // namespace agent
