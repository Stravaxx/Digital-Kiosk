#pragma once

#include <string>
#include <vector>

namespace agent {

class AgentApp {
public:
  explicit AgentApp(std::string configPath);
  int run();

private:
  struct RendererConfig {
    std::string command;
    std::vector<std::string> args;
  };

  std::string configPath_;
  std::string rawConfig_;
  RendererConfig windowsRenderer_;
  RendererConfig linuxRenderer_;

  void log(const std::string& level, const std::string& message) const;
  bool loadConfig();
  bool startRendererHost() const;
  bool startSyncLoop() const;
  bool startWatchdogLoop() const;
  static std::string readTextFile(const std::string& filePath);
  static std::string trim(const std::string& value);
  static std::string extractJsonString(const std::string& source, const std::string& key);
  static std::vector<std::string> extractJsonArrayStrings(const std::string& source, const std::string& key);
  static std::string extractJsonObject(const std::string& source, const std::string& key);
  static std::string shellEscape(const std::string& value);
  static bool launchDetachedWindows(const std::string& command, const std::vector<std::string>& args);
  static bool launchDetachedLinux(const std::string& command, const std::vector<std::string>& args);
};

} // namespace agent
