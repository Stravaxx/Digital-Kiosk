#include <iostream>

namespace agent::platform::linux_stub {

void print_service_hint() {
  std::cout << "Linux service mode: use systemd unit kiosk-agent.service" << std::endl;
}

} // namespace agent::platform::linux_stub
