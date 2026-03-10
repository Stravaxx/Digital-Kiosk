#include "agent/AgentApp.hpp"

#include <string>

int main(int argc, char** argv) {
  std::string configPath = "config/agent-config.json";
  if (argc > 1 && argv[1] != nullptr) {
    configPath = argv[1];
  }

  agent::AgentApp app(configPath);
  return app.run();
}
